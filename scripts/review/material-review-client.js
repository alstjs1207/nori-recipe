(() => {
  const { manifest, initialMaterialRecords = [] } = JSON.parse(document.getElementById("review-data").textContent);
  const entries = new Map(manifest.materialEntries.map((entry) => [entry.slug, entry]));
  const decisions = ["pending", "add", "replace", "held"];
  const labels = { pending: "미검수", add: "신규 추가", replace: "대체", held: "보류" };
  const fresh = (entry) => ({ slug: entry.slug, state: entry.state, materialHash: entry.materialHash,
    decision: entry.appliedDecision?.decision ?? "pending",
    replacementSlug: entry.appliedDecision?.replacementSlug ?? null,
    comment: entry.appliedDecision?.comment ?? "", confirmed: entry.appliedDecision?.confirmed ?? false, updatedAt: null });
  let records = new Map(manifest.materialEntries.map((entry) => [entry.slug, { ...fresh(entry),
    ...initialMaterialRecords.find((record) => record.slug === entry.slug) }]));
  function validate(values, { allowIncomplete = false } = {}) {
    if (!Array.isArray(values) || values.length !== entries.size) throw new Error("신규 재료 전체의 검수 기록이 필요합니다.");
    const allowed = new Set(manifest.existingMaterials.map((m) => m.slug));
    const seen = new Set();
    for (const record of values) {
      const entry = entries.get(record.slug);
      if (!entry || seen.has(record.slug) || entry.state !== record.state || entry.materialHash !== record.materialHash ||
          !decisions.includes(record.decision) || typeof record.confirmed !== "boolean" ||
          typeof record.comment !== "string" || record.comment.length > 10000 ||
          !(record.replacementSlug === null || typeof record.replacementSlug === "string")) throw new Error("잘못된 재료 검수 기록입니다.");
      seen.add(record.slug);
      if (record.replacementSlug !== null && (!allowed.has(record.replacementSlug) || record.replacementSlug === record.slug)) throw new Error("대체 대상은 승인된 기존 재료에서 선택해 주세요.");
      if (!allowIncomplete && ["add", "replace"].includes(record.decision) && !record.confirmed) throw new Error(entry.name + ": 용도와 기존 재료 비교를 확인해 주세요.");
      if (record.decision === "add" && Object.hasOwn(entry, "imageHash") && !entry.imageHash) throw new Error(entry.name + ": 실제 재료 이미지가 필요합니다.");
      if (!allowIncomplete && record.decision === "replace" && (!record.replacementSlug || !record.comment.trim())) throw new Error(entry.name + ": 대체 재료와 대체 이유를 남겨 주세요.");
    }
  }
  function render(slug) {
    const card = document.getElementById("material-" + slug), record = records.get(slug);
    card.dataset.decision = record.decision;
    card.querySelector(".material-decision-label").textContent = labels[record.decision];
    card.querySelector("textarea").value = record.comment;
    card.querySelector("select").value = record.replacementSlug ?? "";
    card.querySelector("input[type=checkbox]").checked = record.confirmed;
    for (const button of card.querySelectorAll("button[data-material-decision]")) button.setAttribute("aria-pressed", String(button.dataset.materialDecision === record.decision));
  }
  function updateView() {
    const query = document.getElementById("material-q").value.trim().toLocaleLowerCase();
    const filter = document.getElementById("material-filter").value;
    const counts = Object.fromEntries(decisions.map((decision) => [decision, 0]));
    for (const record of records.values()) counts[record.decision]++;
    for (const [decision, count] of Object.entries(counts)) document.querySelector('[data-material-count="' + decision + '"]').textContent = count;
    for (const card of document.querySelectorAll(".material-card")) {
      const slug = card.id.slice("material-".length);
      card.hidden = !(card.dataset.search.includes(query) && (filter === "all" || records.get(slug).decision === filter));
    }
    for (const item of document.querySelectorAll(".catalog-item")) item.hidden = !item.dataset.search.includes(query);
    for (const group of document.querySelectorAll(".catalog-category")) group.hidden = !group.querySelector(".catalog-item:not([hidden])");
    if (query && document.querySelector(".catalog-item:not([hidden])")) document.querySelector(".catalog").open = true;
  }
  function notify(intent) {
    updateView();
    document.dispatchEvent(new CustomEvent("nori-material-change", { detail: intent }));
  }
  window.noriMaterialReview = {
    records: () => manifest.materialEntries.map((entry) => records.get(entry.slug)),
    blocksPlay: (entry) => [...records.values()].some((record) => ["held", "replace"].includes(record.decision) && entry.materialSlugs.includes(record.slug)),
    validate,
    restore(values, { reconcile = false } = {}) {
      if (!reconcile) validate(values, { allowIncomplete: Boolean(window.noriReviewPersistence) });
      let reset = 0;
      for (const entry of manifest.materialEntries) {
        const old = values?.find((record) => record.slug === entry.slug);
        if (!old) continue;
        if (old.state === entry.state && old.materialHash === entry.materialHash) {
          const candidate = manifest.materialEntries.map((m) => m.slug === entry.slug ? old : fresh(m));
          validate(candidate, { allowIncomplete: reconcile });
          records.set(entry.slug, { ...fresh(entry), decision: old.decision, comment: old.comment,
            replacementSlug: old.replacementSlug, confirmed: old.confirmed, updatedAt: old.updatedAt ?? null });
        } else if (reconcile) {
          const record = fresh(entry);
          if (typeof old.comment === "string") record.comment = old.comment.slice(0, 10000);
          records.set(entry.slug, record);
          reset++;
        }
      }
      for (const entry of manifest.materialEntries) render(entry.slug);
      updateView();
      return reset;
    },
  };
  for (const entry of manifest.materialEntries) render(entry.slug);
  updateView();
  document.getElementById("material-q").addEventListener("input", updateView);
  document.getElementById("material-filter").addEventListener("change", updateView);
  document.getElementById("material-grid").addEventListener("input", (event) => {
    if (event.target.matches("textarea")) {
      const slug = event.target.closest(".material-card").id.slice("material-".length);
      Object.assign(records.get(slug), { comment: event.target.value, updatedAt: new Date().toISOString() });
      notify();
    }
  });
  document.getElementById("material-grid").addEventListener("change", (event) => {
    if (!event.target.matches("[data-material-field]")) return;
    const slug = event.target.closest(".material-card").id.slice("material-".length);
    const field = event.target.dataset.materialField;
    Object.assign(records.get(slug), { [field]: field === "confirmed" ? event.target.checked : event.target.value || null, updatedAt: new Date().toISOString() });
    render(slug);
    notify();
  });
  document.getElementById("material-grid").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-material-decision]");
    if (!button) return;
    const slug = button.closest(".material-card").id.slice("material-".length);
    Object.assign(records.get(slug), { decision: button.dataset.materialDecision, updatedAt: new Date().toISOString() });
    render(slug);
    notify(button.dataset.materialDecision === "pending" ? undefined : { type: "material", id: slug });
  });
  document.getElementById("materials-panel").addEventListener("click", (event) => {
    const link = event.target.closest(".usage-link");
    if (!link) return;
    event.preventDefault();
    document.dispatchEvent(new CustomEvent("nori-open-play", { detail: link.dataset.playId }));
  });
})();
