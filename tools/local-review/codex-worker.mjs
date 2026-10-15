import path from "node:path";
import { fileURLToPath } from "node:url";
import { openCodexClient } from "./codex-client.mjs";
import { messageFor } from "./codex-requests.mjs";
import { atomicWrite, readAt, json } from "./files.mjs";

export async function runCodexReview(root, file, command) {
  let request = readAt(root, file), client, started = false;
  const write = (fields) => { request = { ...request, ...fields }; atomicWrite(root, file, json(request)); };
  const reply = (value) => { if (process.connected) process.send(value, () => {}); };
  let finish;
  const completed = new Promise((resolve) => { finish = resolve; });
  try {
    client = await openCodexClient(command, root, { onNotification(message) {
      if (message.method === "turn/completed" && message.params?.threadId === request.threadId) finish(message.params.turn);
      else if (message.method === "client/closed") finish({ status: "failed", error: { message: "Codex connection closed" } });
      else if (message.method === "client/needsAttention") write({ needsAttention: true });
    } });
    if (request.threadId) await client.call("thread/resume", { threadId: request.threadId, excludeTurns: true });
    else {
      const created = await client.call("thread/start", { cwd: root, ephemeral: false, sandbox: "workspace-write" });
      if (!/^[a-f0-9-]{36}$/i.test(created.thread?.id ?? "")) throw new Error("Invalid new chat identity");
      write({ threadId: created.thread.id, threadUrl: "codex://threads/" + created.thread.id, status: "created" });
    }
    await client.call("thread/name/set", { threadId: request.threadId, name: "놀이 검수 · " + String(request.title ?? request.batchId).slice(0, 100) });
    const result = await client.call("turn/start", { threadId: request.threadId, input: [{ type: "text", text: messageFor(root, request, file) }] });
    if (!result.turn?.id) throw new Error("Codex did not acknowledge the request");
    write({ status: "queued", turnId: result.turn.id, queuedAt: new Date().toISOString(), runStatus: result.turn.status ?? "inProgress" });
    started = true;
    reply({ type: "started", threadId: request.threadId, threadUrl: request.threadUrl, turnId: request.turnId });
    const turn = await completed;
    write({ runStatus: turn.status, completedAt: new Date().toISOString(), ...(turn.error ? { runError: String(turn.error.message ?? "Codex 작업 실패").slice(0, 1000) } : {}) });
  } catch (error) {
    const uncertain = !["ENOENT", "EACCES", "ENOEXEC"].includes(error.code) && !Number.isInteger(error.code);
    write(started ? { runStatus: "failed" } : { status: uncertain ? "unknown" : "failed", errorCode: String(error.code ?? "CODEX_ERROR") });
    reply({ type: "failed", uncertain, threadId: request.threadId, threadUrl: request.threadUrl });
  } finally { client?.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCodexReview(process.cwd(), process.argv[2], process.argv[3]).catch(() => { process.exitCode = 1; });
}
