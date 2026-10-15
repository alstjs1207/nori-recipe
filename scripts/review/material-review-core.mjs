import { canonical, sha256 } from "./review-shared.mjs";
import { materialImageInfo } from "./material-images.mjs";

export const MATERIAL_DECISIONS = ["pending", "add", "replace", "held"];
export function methodHash(play) {
  return sha256(JSON.stringify(canonical({ steps: play.steps, safetyNotes: play.safetyNotes,
    preparationNotes: play.preparationNotes ?? [], tip: play.tip ?? "" })));
}
export function replacementPending(play, extra) {
  return (extra?.materialReplacementChecks ?? []).some((check) => check.previousMethodHash === methodHash(play));
}
export function describeMaterials(batch, registry, root) {
  const pending = new Set(registry.reviewPending ?? []);
  const category = (slug) => Object.keys(registry.categories).find((key) => registry.categories[key].includes(slug));
  const existingMaterials = Object.entries(registry.displayNames).filter(([slug]) => !pending.has(slug))
    .map(([slug, name]) => ({ slug, name, category: category(slug) }));
  const proposals = batch.materialProposals ?? [];
  if (new Set(proposals.map((p) => p.slug)).size !== proposals.length) throw new Error("중복된 신규 재료 제안입니다.");
  const materialEntries = proposals.map((proposal) => {
    const { slug } = proposal;
    if (!registry.displayNames[slug] || !category(slug)) throw new Error("재료 제안의 임시 정의를 찾을 수 없습니다: " + slug);
    const applied = batch.appliedMaterialDecisions?.[slug];
    const state = pending.has(slug)
      ? (applied?.decision === "add" ? "reopened" : applied?.decision === "replace" ? "replaced" : applied?.decision === "held" ? "held" : "pending")
      : "added";
    const image = batch.materialImagesRequired ? { imageHash: materialImageInfo(root, slug).hash } : {};
    return { ...proposal, name: registry.displayNames[slug], category: category(slug), state,
      ...image,
      appliedDecision: applied ?? null,
      pendingApproval: pending.has(slug),
      materialHash: sha256(JSON.stringify(canonical({ proposal, name: registry.displayNames[slug], category: category(slug), ...image }))) };
  });
  return { existingMaterials, materialEntries };
}

export function validateMaterialRecords(records, manifest, { allowIncomplete = false } = {}) {
  if (!Array.isArray(records) || records.length !== manifest.materialEntries.length) throw new Error("신규 재료 전체의 검수 기록이 필요합니다.");
  const expected = new Map(manifest.materialEntries.map((entry) => [entry.slug, entry]));
  const allowedTargets = new Set(manifest.existingMaterials.map((entry) => entry.slug));
  const seen = new Set();
  for (const record of records) {
    const entry = expected.get(record.slug);
    if (!entry || seen.has(record.slug)) throw new Error("배치 밖 또는 중복 재료: " + record.slug);
    seen.add(record.slug);
    if (record.materialHash !== entry.materialHash || record.state !== entry.state) throw new Error(record.slug + ": 재료 검토 대상이 바뀌었습니다.");
    if (!MATERIAL_DECISIONS.includes(record.decision) || typeof record.confirmed !== "boolean" ||
        typeof record.comment !== "string" || record.comment.length > 10000 ||
        !(record.replacementSlug === null || typeof record.replacementSlug === "string")) throw new Error("잘못된 재료 검수 기록: " + record.slug);
    if (record.replacementSlug !== null && (!allowedTargets.has(record.replacementSlug) || record.replacementSlug === record.slug)) {
      throw new Error(record.slug + ": 대체 대상은 승인된 기존 재료에서 선택해야 합니다.");
    }
    if (!allowIncomplete && ["add", "replace"].includes(record.decision) && !record.confirmed) throw new Error(record.slug + ": 기존 재료와 용도 비교를 확인해 주세요.");
    if (record.decision === "add" && Object.hasOwn(entry, "imageHash") && !entry.imageHash) throw new Error(record.slug + ": 실제 재료 이미지가 있어야 신규 추가할 수 있습니다.");
    if (!allowIncomplete && record.decision === "replace" && (!record.replacementSlug || !record.comment.trim())) throw new Error(record.slug + ": 대체 재료와 대체 이유가 필요합니다.");
  }
}

export function planMaterialChanges(bundle, registry, batch, records) {
  const nextBundle = structuredClone(bundle), nextRegistry = structuredClone(registry), nextBatch = structuredClone(batch);
  const pending = new Set(nextRegistry.reviewPending ?? []);
  nextBatch.appliedMaterialDecisions ??= {};
  const addedSlugs = [], replacements = [], heldSlugs = [], changedPlayIds = new Set();
  for (const record of records) {
    if (record.decision === "pending") continue;
    if (record.decision === "add") { pending.delete(record.slug); addedSlugs.push(record.slug); }
    if (record.decision === "held") {
      // Withdrawing a material used by a published play is not a batch review operation.
      if (nextBundle.plays.some((p) => p.status === "live" && [...p.materials.required, ...p.materials.optional].includes(record.slug))) {
        throw new Error(record.slug + ": 게시 중인 놀이에서 사용합니다. 기존 게시물의 변경을 별도로 검토해 주세요.");
      }
      pending.add(record.slug);
      heldSlugs.push(record.slug);
    }
    if (record.decision === "replace") {
      const affected = nextBundle.plays.filter((p) => [...p.materials.required, ...p.materials.optional].includes(record.slug));
      if (affected.some((p) => !batch.playIds.includes(p.id) || p.status !== "draft")) throw new Error(record.slug + ": 이 배치의 초안 외에서도 사용되어 일괄 대체할 수 없습니다.");
      for (const play of affected) {
        const before = methodHash(play);
        play.materials.required = [...new Set(play.materials.required.map((slug) => slug === record.slug ? record.replacementSlug : slug))];
        play.materials.optional = [...new Set(play.materials.optional.map((slug) => slug === record.slug ? record.replacementSlug : slug))]
          .filter((slug) => !play.materials.required.includes(slug));
        play.imageStatus = "review";
        nextBatch.entries ??= [];
        let extra = nextBatch.entries.find((entry) => entry.id === play.id);
        if (!extra) { extra = { id: play.id }; nextBatch.entries.push(extra); }
        extra.materialReplacementChecks ??= [];
        extra.materialReplacementChecks.push({ from: record.slug, to: record.replacementSlug,
          reason: record.comment, previousMethodHash: before });
        changedPlayIds.add(play.id);
      }
      // Keep the unused provisional definition for provenance, hidden from selection.
      pending.add(record.slug);
      replacements.push({ from: record.slug, to: record.replacementSlug, playIds: affected.map((p) => p.id) });
    }
    nextBatch.appliedMaterialDecisions[record.slug] = { decision: record.decision,
      replacementSlug: record.replacementSlug, comment: record.comment, confirmed: record.confirmed };
  }
  nextRegistry.reviewPending = [...pending].sort();
  return { nextBundle, nextRegistry, nextBatch, addedSlugs, replacements, heldSlugs, changedPlayIds: [...changedPlayIds] };
}
