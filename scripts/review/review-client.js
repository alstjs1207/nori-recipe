(() => {
  "use strict";
  const model = JSON.parse(document.getElementById("review-data").textContent);
  const { manifest } = model;
  const persistence = window.noriReviewPersistence;
  const validDecisions = ["pending", "approved", "changes_requested", "held"];
  const labels = { pending: "미검수", approved: "승인", changes_requested: "수정 요청", held: "보류" };
  const storageKey = "nori:play-review:v1:" + manifest.batchId;
  const entries = new Map(manifest.entries.map((entry) => [entry.id, entry]));
  const registered = (entry) => entry.status === "live" && entry.imageStatus === null;
  const initial = new Map((model.initialRecords ?? []).map((record) => [record.id, record]));
  const fresh = (entry) => ({ ...entry, decision: "pending", comment: "",
    contentReviewed: false, imageReviewed: false, updatedAt: null, ...initial.get(entry.id) });
  let records = new Map(manifest.entries.map((entry) => [entry.id, fresh(entry)]));
  const justApproved = new Set();
  let storageError = false;
  const notice = document.getElementById("notice");
  const setNotice = (message, error = false) => {
    notice.textContent = message;
    notice.className = error ? "notice error" : "notice";
  };
  const payload = () => ({ schemaVersion: 2, batchId: manifest.batchId,
    batchHash: manifest.batchHash, exportedAt: new Date().toISOString(),
    records: manifest.entries.map((entry) => records.get(entry.id)),
    materialRecords: window.noriMaterialReview.records() });

  function validateImport(value, { allowIncomplete = false } = {}) {
    if (value?.schemaVersion !== 2 || value.batchId !== manifest.batchId ||
        value.batchHash !== manifest.batchHash || !Array.isArray(value.records) ||
        value.records.length !== entries.size) throw new Error("현재 검수 배치와 다른 결과입니다. 같은 버전의 JSON을 가져와 주세요.");
    window.noriMaterialReview.validate(value.materialRecords, { allowIncomplete });
    const seen = new Set();
    for (const record of value.records) {
      const entry = entries.get(record.id);
      if (!entry || seen.has(record.id) || record.contentHash !== entry.contentHash ||
          record.imageHash !== entry.imageHash || record.status !== entry.status ||
          record.imageStatus !== entry.imageStatus || !validDecisions.includes(record.decision) ||
          typeof record.comment !== "string" || record.comment.length > 10000 ||
          typeof record.contentReviewed !== "boolean" || typeof record.imageReviewed !== "boolean") {
        throw new Error("잘못된 검수 기록이 포함되어 있습니다.");
      }
      seen.add(record.id);
      if (!allowIncomplete && record.decision === "changes_requested" && !record.comment.trim()) throw new Error("수정 요청에는 의견이 필요합니다.");
      if (record.imageReviewed && !entry.imageHash) throw new Error("대표 이미지가 없는 항목을 확인 완료로 표시할 수 없습니다.");
      if (record.decision === "approved" && (!record.contentReviewed || !record.imageReviewed || !entry.imageHash)) {
        throw new Error("승인 항목은 내용과 대표 이미지 확인을 모두 마쳐야 합니다.");
      }
      if (record.decision === "approved" && (entry.unapprovedMaterials.length || entry.replacementReviewRequired ||
          value.materialRecords.some((material) => ["held", "replace"].includes(material.decision) && entry.materialSlugs.includes(material.slug)))) throw new Error("재료 결과를 먼저 반영하고 대체된 방법·주의사항을 다시 검수해 주세요.");
    }
  }

  function save(intent) {
    if (persistence) { persistence.save(payload(), intent); return; }
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload()));
      storageError = false;
      document.getElementById("save-status").textContent = "자동 저장됨 · " + new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul" });
    } catch {
      storageError = true;
      document.getElementById("save-status").textContent = "브라우저 저장 불가";
      setNotice("브라우저에 저장하지 못했습니다. 화면을 닫기 전에 결과 JSON을 내보내 보관해 주세요.", true);
    }
  }

  function updateCard(id) {
    const card = document.getElementById(id);
    const record = records.get(id);
    const complete = registered(entries.get(id));
    card.dataset.registered = String(complete);
    card.dataset.decision = record.decision;
    card.querySelector(".decision-label").textContent = complete ? "등록 완료" : labels[record.decision];
    card.querySelector("textarea").value = record.comment;
    card.querySelector("textarea").readOnly = complete;
    card.querySelector('[data-field="contentReviewed"]').disabled = complete;
    if (complete) card.querySelector('[data-field="imageReviewed"]').disabled = true;
    card.querySelector('[data-field="contentReviewed"]').checked = record.contentReviewed;
    card.querySelector('[data-field="imageReviewed"]').checked = record.imageReviewed;
    const entry = entries.get(id);
    card.querySelector('[data-decision="approved"]').disabled = complete || card.querySelector('[data-field="imageReviewed"]').disabled ||
      entry.unapprovedMaterials.length > 0 || entry.replacementReviewRequired || window.noriMaterialReview.blocksPlay(entry);
    for (const button of card.querySelectorAll("[data-decision]")) {
      if (complete) button.disabled = true;
      button.setAttribute("aria-pressed", String(button.dataset.decision === record.decision));
    }
  }

  function updateView() {
    const counts = Object.fromEntries(validDecisions.map((value) => [value, 0]));
    let completed = 0;
    for (const record of records.values()) {
      if (registered(entries.get(record.id))) completed++;
      else counts[record.decision]++;
    }
    document.querySelector("[data-registered-count]").textContent = completed;
    for (const decision of validDecisions) {
      document.querySelector('[data-count="' + decision + '"]').textContent = counts[decision];
    }
    const progress = document.querySelector(".sidebar-progress");
    if (progress) {
      progress.querySelector("strong").textContent = completed;
      progress.querySelector("small").textContent = " / " + entries.size + "개 등록";
      progress.querySelector(".progress-track span").style.width = (entries.size ? completed / entries.size * 100 : 0) + "%";
      progress.querySelector("p").textContent = entries.size - completed ? (entries.size - completed) + "개 항목을 검수하고 있어요." : "검수할 항목이 없습니다.";
    }
    const query = document.getElementById("q").value.trim().toLocaleLowerCase();
    const filter = document.getElementById("filter").value;
    let visible = 0;
    for (const card of document.querySelectorAll(".card")) {
      const record = records.get(card.id);
      const complete = registered(entries.get(card.id));
      const matchesFilter = filter === "all" || justApproved.has(card.id) || (filter === "registered" ? complete : !complete && record.decision === filter);
      card.hidden = !(card.dataset.search.includes(query) && matchesFilter);
      if (!card.hidden) visible++;
    }
    document.getElementById("visible-count").textContent = visible + " / " + entries.size + "개 표시";
    document.getElementById("empty").hidden = visible !== 0;
    document.getElementById("grid").dataset.single = String(visible === 1);
  }

  function change(id, update, intent) {
    const record = records.get(id);
    Object.assign(record, update, { updatedAt: new Date().toISOString() });
    if (record.decision === "approved" && (!record.contentReviewed || !record.imageReviewed)) record.decision = "pending";
    save(intent);
    updateCard(id);
    updateView();
  }

  try {
    const saved = persistence ? null : localStorage.getItem(storageKey);
    if (saved) {
      const old = JSON.parse(saved);
      if (![1, 2].includes(old.schemaVersion) || old.batchId !== manifest.batchId || !Array.isArray(old.records)) {
        throw new Error("이전 저장 기록의 형식을 확인할 수 없습니다.");
      }
      let reset = 0;
      if (Array.isArray(old.materialRecords)) reset += window.noriMaterialReview.restore(old.materialRecords, { reconcile: true });
      for (const entry of manifest.entries) {
        const previous = old.records.find((record) => record.id === entry.id);
        if (!previous) continue;
        const baseline = initial.get(entry.id);
        if (baseline && (!previous.updatedAt || previous.updatedAt < baseline.updatedAt)) continue;
        if (previous.contentHash === entry.contentHash && previous.imageHash === entry.imageHash &&
            previous.status === entry.status && previous.imageStatus === entry.imageStatus) {
          const record = { ...fresh(entry), decision: previous.decision, comment: previous.comment,
            contentReviewed: previous.contentReviewed, imageReviewed: previous.imageReviewed,
            updatedAt: previous.updatedAt ?? null };
          if (entry.unapprovedMaterials.length || entry.replacementReviewRequired || window.noriMaterialReview.blocksPlay(entry)) record.decision = record.decision === "approved" ? "pending" : record.decision;
          const candidate = { ...payload(), records: manifest.entries.map((e) => e.id === entry.id ? record : fresh(e)) };
          validateImport(candidate, { allowIncomplete: true });
          records.set(entry.id, record);
        } else {
          const record = fresh(entry);
          record.comment = typeof previous.comment === "string" ? previous.comment.slice(0, 10000) : "";
          records.set(entry.id, record);
          if (!registered(entry)) reset++;
        }
      }
      document.getElementById("save-status").textContent = "저장 기록 불러옴";
      setNotice(reset ? reset + "개 항목의 내용·이미지가 바뀌어 미검수로 되돌렸습니다. 의견은 유지했습니다." : "이 브라우저에 저장된 검수 기록을 불러왔습니다.");
    }
  } catch (error) {
    setNotice("저장 기록을 불러오지 못했습니다. " + error.message + " 보관한 JSON을 가져오거나 새로 검수해 주세요.", true);
  }

  for (const entry of manifest.entries) updateCard(entry.id);
  const incomplete = [...records.values()].filter((r) => !registered(entries.get(r.id)));
  const defaultFilter = ["pending", "changes_requested", "approved", "held"].find((d) => incomplete.some((r) => r.decision === d));
  document.getElementById("filter").value = defaultFilter ?? ([...entries.values()].some(registered) ? "registered" : "all");
  function showLinkedPlay() {
    const linkedId = location.hash.slice(1);
    if (!entries.has(linkedId)) return;
    document.getElementById("filter").value = "all";
    document.getElementById("q").value = linkedId;
    updateView();
  }
  updateView();
  showLinkedPlay();
  window.addEventListener("hashchange", showLinkedPlay);

  function showPanel(name) {
    const materials = name === "materials";
    document.body.classList.toggle("materials-view", materials);
    document.getElementById("plays-panel").hidden = materials;
    document.getElementById("materials-panel").hidden = !materials;
    for (const id of ["q", "filter", "clear-search", "visible-count"]) document.getElementById(id).hidden = materials;
    document.querySelector(".play-filter-toolbar").hidden = materials;
    document.getElementById("plays-tab").setAttribute("aria-selected", String(!materials));
    document.getElementById("materials-tab").setAttribute("aria-selected", String(materials));
  }
  document.getElementById("plays-tab").addEventListener("click", () => showPanel("plays"));
  document.getElementById("materials-tab").addEventListener("click", () => showPanel("materials"));
  document.addEventListener("nori-open-play", (event) => {
    showPanel("plays");
    document.getElementById("q").value = event.detail;
    document.getElementById("filter").value = "all";
    updateView();
    document.getElementById(event.detail)?.scrollIntoView({ block: "start" });
  });
  document.addEventListener("nori-material-change", (event) => {
    for (const entry of manifest.entries) {
      if (window.noriMaterialReview.blocksPlay(entry) && records.get(entry.id).decision === "approved") records.get(entry.id).decision = "pending";
      updateCard(entry.id);
    }
    updateView();
    save(event.detail);
    if (!persistence && !storageError) setNotice("재료 검수 선택과 의견을 저장했습니다. 재료 결과는 별도로 먼저 반영합니다.");
  });

  document.getElementById("q").addEventListener("input", () => { justApproved.clear(); updateView(); });
  document.getElementById("filter").addEventListener("change", () => { justApproved.clear(); updateView(); });
  document.getElementById("clear-search").addEventListener("click", () => {
    justApproved.clear();
    document.getElementById("q").value = "";
    document.getElementById("filter").value = "all";
    updateView();
  });
  document.getElementById("grid").addEventListener("input", (event) => {
    if (event.target.matches("textarea")) {
      const id = event.target.closest(".card").id;
      // Keep focus and selection while saving the text.
      records.get(id).comment = event.target.value;
      records.get(id).updatedAt = new Date().toISOString();
      save();
    }
  });
  document.getElementById("grid").addEventListener("change", (event) => {
    if (event.target.matches("[data-field]")) {
      change(event.target.closest(".card").id, { [event.target.dataset.field]: event.target.checked });
    }
  });
  document.getElementById("grid").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-decision]");
    if (!button) return;
    const id = button.closest(".card").id;
    const record = records.get(id);
    if (button.dataset.decision === "approved" && (!record.contentReviewed || !record.imageReviewed || !entries.get(id).imageHash ||
        entries.get(id).unapprovedMaterials.length || entries.get(id).replacementReviewRequired || window.noriMaterialReview.blocksPlay(entries.get(id)))) {
      setNotice(id + ": 내용과 대표 이미지를 확인한 뒤 승인해 주세요.", true);
      return;
    }
    change(id, { decision: button.dataset.decision }, button.dataset.decision === "approved" ? { type: "play", id } : undefined);
    if (!persistence && !storageError) setNotice(button.dataset.decision === "changes_requested" && !record.comment.trim()
      ? id + ": 수정할 내용을 의견에 남겨 주세요." : id + " · " + labels[button.dataset.decision] + " 저장");
  });
  document.getElementById("grid").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-unused]");
    if (!button || !persistence) return;
    persistence.save(payload(), { type: "unused", id: button.closest(".card").id });
  });
  window.noriPlayReview = {
    apply(snapshot, intent) {
      const y = scrollY;
      if (intent.type === "play") justApproved.add(intent.id);
      const remaining = new Set(snapshot.manifest.entries.map((entry) => entry.id));
      for (const id of entries.keys()) if (!remaining.has(id)) document.getElementById(id)?.remove();
      Object.assign(manifest, snapshot.manifest);
      entries.clear();
      for (const entry of manifest.entries) entries.set(entry.id, entry);
      records = new Map(snapshot.results.records.map((record) => [record.id, record]));
      window.noriMaterialReview.apply(snapshot);
      for (const entry of manifest.entries) updateCard(entry.id);
      document.querySelector("#plays-tab span").textContent = entries.size;
      if (intent.type === "unused") {
        justApproved.delete(intent.id);
        for (const link of document.querySelectorAll(".usage-link")) if (link.dataset.playId === intent.id) link.remove();
      }
      updateView();
      requestAnimationFrame(() => scrollTo(0, y));
    },
  };
  for (const image of document.querySelectorAll(".representative-image")) {
    const markFailure = () => {
      const id = image.closest(".card").id;
      const card = document.getElementById(id);
      card.querySelector('[data-field="imageReviewed"]').disabled = true;
      card.querySelector('[data-decision="approved"]').disabled = true;
      card.querySelector(".image-state").textContent = "대표 이미지를 불러오지 못했습니다";
      if (persistence) {
        records.get(id).imageReviewed = false;
        updateCard(id);
        updateView();
      } else change(id, { imageReviewed: false });
      setNotice(id + ": 이미지 경로를 확인하고 검수 화면을 다시 생성해 주세요.", true);
    };
    image.addEventListener("error", markFailure);
    if (image.complete && image.naturalWidth === 0) markFailure();
  }
  document.getElementById("export").addEventListener("click", () => {
    try {
      const value = payload();
      validateImport(value, { allowIncomplete: Boolean(persistence) });
      const blob = new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      anchor.download = "play-review-" + manifest.batchId + "-" + day + ".json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (!storageError) setNotice("검수 결과 JSON을 내보냈습니다. " + manifest.entries.length + "개 항목의 상태·의견이 포함됩니다.");
    } catch (error) { setNotice(error.message, true); }
  });
  document.getElementById("import").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      validateImport(value, { allowIncomplete: Boolean(persistence) });
      window.noriMaterialReview.restore(value.materialRecords);
      records = new Map(value.records.map((record) => [record.id, { ...entries.get(record.id),
        decision: record.decision, comment: record.comment, contentReviewed: record.contentReviewed,
        imageReviewed: record.imageReviewed, updatedAt: record.updatedAt ?? null }]));
      save();
      for (const entry of manifest.entries) updateCard(entry.id);
      updateView();
      if (!storageError) setNotice("검수 결과를 가져와 저장했습니다.");
    } catch (error) { setNotice(error.message, true); }
    event.target.value = "";
  });
  persistence?.ready(payload);
})();
