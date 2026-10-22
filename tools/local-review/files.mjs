import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const STATE = "results/local-review/state.json";
const TRANSACTIONS = "results/local-review/transactions";
export const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
export const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
export class ReviewError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Both reads and writes reject symlinks, including symlinked parent directories.
export function fileAt(root, relative) {
  if (typeof relative !== "string" || relative.includes("\\") || relative.includes("\0") ||
      path.isAbsolute(relative) || relative.split("/").some((p) => !p || p === "." || p === "..")) {
    throw new ReviewError(400, "허용되지 않은 파일 경로입니다.");
  }
  let file = root;
  for (const part of relative.split("/")) {
    file = path.join(file, part);
    if (fs.lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new ReviewError(400, "심볼릭 링크는 로컬 검수에서 사용할 수 없습니다.");
    }
  }
  return file;
}
export const bytesAt = (root, relative) => {
  const file = fileAt(root, relative);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
};
export const readAt = (root, relative) => JSON.parse(bytesAt(root, relative)?.toString() ?? "null");

export function walk(root, directory, accept = () => true) {
  const file = fileAt(root, directory);
  if (!fs.existsSync(file)) return [];
  return fs.readdirSync(file, { withFileTypes: true }).flatMap((item) => {
    const relative = directory + "/" + item.name;
    fileAt(root, relative);
    return item.isDirectory() ? walk(root, relative, accept) : accept(relative) ? [relative] : [];
  }).sort();
}

// Re-hash file bytes on every operation: external CLI writes need no cooperation.
export function fingerprint(root) {
  const files = ["data/plays.json", "data/materials.json", "src/constants/playImages.ts",
    "src/constants/materialImageSources.ts", "assets/icon.png", STATE,
    ...walk(root, "data/review-batches", (p) => p.endsWith(".json")),
    ...walk(root, "images/plays"), ...walk(root, "images/material"),
    ...walk(root, "results/review-backups", (p) => p.endsWith("/receipt.json")),
    ...walk(root, "results/material-review-backups", (p) => p.endsWith("/receipt.json"))];
  return Object.fromEntries([...new Set(files)].sort().map((p) => {
    const bytes = bytesAt(root, p);
    return [p, bytes === null ? null : hash(bytes)];
  }));
}
export const revisionOf = (files) => hash(JSON.stringify(files));

function syncDirectory(directory) {
  const fd = fs.openSync(directory, "r");
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
export function atomicWrite(root, relative, bytes) {
  const target = fileAt(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = target + ".local-review-" + crypto.randomUUID();
  try {
    const mode = fs.existsSync(target) ? fs.statSync(target).mode & 0o777 : 0o600;
    const fd = fs.openSync(temp, "wx", mode);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, target);
    syncDirectory(path.dirname(target));
  } finally { fs.rmSync(temp, { force: true }); }
}

const allowedTarget = (p) => [STATE, "data/plays.json", "data/materials.json", "src/constants/playImages.ts"].includes(p) ||
  /^images\/plays\/play_\d{3,}\.jpeg$/.test(p) ||
  p.startsWith("data/review-batches/") && p.endsWith(".json") ||
  /^results\/(?:material-review-backups|review-backups)\/[\w-]+\/[\w.-]+$/.test(p);

export function pendingTransactions(root) {
  return walk(root, TRANSACTIONS, (p) => p.endsWith("/plan.json"))
    .filter((p) => readAt(root, p)?.status === "prepared").map((p) => p.split("/").at(-2));
}

// Prepare is durable before replacing any master. CLI recovery uses the same journal.
export function prepareTransaction(root, updates, expectedFiles) {
  if (revisionOf(fingerprint(root)) !== revisionOf(expectedFiles)) throw new ReviewError(409, "파일이 변경되었습니다. 최신 화면에서 다시 검수해 주세요.");
  const id = new Date().toISOString().replace(/[:.]/g, "-") + "-" + crypto.randomUUID().slice(0, 8);
  const directory = TRANSACTIONS + "/" + id;
  const entries = [];
  for (const [relative, after] of updates) {
    if (!allowedTarget(relative)) throw new Error("거래 대상 경로 오류: " + relative);
    const before = bytesAt(root, relative);
    if (before === null && after === null || before !== null && after !== null && before.equals(after)) continue;
    const index = entries.length;
    if (before !== null) atomicWrite(root, directory + "/" + index + ".before", before);
    if (after !== null) atomicWrite(root, directory + "/" + index + ".after", after);
    entries.push({ relative, beforeHash: before === null ? null : hash(before), afterHash: after === null ? null : hash(after), index });
  }
  const plan = { schemaVersion: 1, id, status: "prepared", createdAt: new Date().toISOString(), entries };
  atomicWrite(root, directory + "/plan.json", json(plan));
  return { plan, directory };
}

export function recoverTransaction(root, id) {
  if (!/^[\w-]+$/.test(id)) throw new ReviewError(400, "잘못된 복구 ID입니다.");
  const directory = TRANSACTIONS + "/" + id;
  const plan = readAt(root, directory + "/plan.json");
  if (plan?.schemaVersion !== 1 || plan.id !== id || plan.status !== "prepared" || !Array.isArray(plan.entries)) {
    throw new ReviewError(400, "복구할 미완료 거래가 없습니다.");
  }
  // Inspect every file first. Never overwrite a later external edit during recovery.
  for (const entry of plan.entries) {
    if (!allowedTarget(entry.relative)) throw new ReviewError(400, "복구 경로 오류");
    const current = bytesAt(root, entry.relative), currentHash = current === null ? null : hash(current);
    if (currentHash !== entry.beforeHash && currentHash !== entry.afterHash) {
      throw new ReviewError(409, "복구 대상에 외부 수정이 있습니다. 백업과 비교해 수동 복구해 주세요: " + entry.relative);
    }
    for (const suffix of ["before", "after"]) {
      const expectedHash = entry[suffix + "Hash"];
      if (expectedHash !== null && hash(bytesAt(root, directory + "/" + entry.index + "." + suffix) ?? Buffer.alloc(0)) !== expectedHash) {
        throw new ReviewError(409, "거래 백업이 손상되었습니다.");
      }
    }
  }
  for (const entry of [...plan.entries].reverse()) {
    if (entry.beforeHash === null) fs.rmSync(fileAt(root, entry.relative), { force: true });
    else atomicWrite(root, entry.relative, bytesAt(root, directory + "/" + entry.index + ".before"));
  }
  atomicWrite(root, directory + "/plan.json", json({ ...plan, status: "recovered", recoveredAt: new Date().toISOString() }));
  return { id, recovered: true };
}

export function commitTransaction(root, updates, expectedFiles) {
  if (pendingTransactions(root).length) throw new ReviewError(423, "중단된 저장이 있습니다. 서버를 종료하고 --recover로 복구해 주세요.");
  const { plan, directory } = prepareTransaction(root, updates, expectedFiles);
  let started = false;
  try {
    if (revisionOf(fingerprint(root)) !== revisionOf(expectedFiles)) throw new ReviewError(409, "반영 직전 파일이 변경되었습니다.");
    for (const entry of plan.entries) {
      const before = bytesAt(root, entry.relative);
      if ((before === null ? null : hash(before)) !== entry.beforeHash) throw new ReviewError(409, "반영 중 파일이 변경되었습니다: " + entry.relative);
      started = true;
      if (entry.afterHash === null) {
        fs.rmSync(fileAt(root, entry.relative), { force: true });
        syncDirectory(path.dirname(fileAt(root, entry.relative)));
      } else atomicWrite(root, entry.relative, bytesAt(root, directory + "/" + entry.index + ".after"));
    }
    const expectedAfter = { ...expectedFiles };
    for (const entry of plan.entries) expectedAfter[entry.relative] = entry.afterHash;
    const actual = fingerprint(root);
    // Only fingerprinted sources participate; receipts created by this transaction are included.
    const changed = new Set(plan.entries.map((e) => e.relative));
    for (const p of new Set([...Object.keys(expectedFiles), ...Object.keys(actual)])) {
      if (!changed.has(p) && actual[p] !== expectedFiles[p]) throw new ReviewError(409, "반영 중 외부 파일이 변경되었습니다: " + p);
      if (changed.has(p) && (actual[p] ?? null) !== expectedAfter[p]) throw new ReviewError(409, "저장된 파일이 변경되었습니다: " + p);
    }
    atomicWrite(root, directory + "/plan.json", json({ ...plan, status: "committed", committedAt: new Date().toISOString() }));
    return plan.id;
  } catch (error) {
    if (!started) {
      atomicWrite(root, directory + "/plan.json", json({ ...plan, status: "cancelled" }));
      throw error;
    }
    try { recoverTransaction(root, plan.id); }
    catch (recovery) { throw new ReviewError(423, error.message + " " + recovery.message + " 복구 ID: " + plan.id); }
    throw error;
  }
}
