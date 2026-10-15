(() => {
  "use strict";
  const config = JSON.parse(document.getElementById("local-review-config").textContent);
  let revision = config.revision, blocked = config.recovery.length > 0;
  let chain = Promise.resolve(), timer, pending, dirty = false, saving = 0, sequence = 0, applying = false, requesting = false, reviewReady = false;
  const codexButton = document.getElementById("codex-request");
  const codexStatus = document.getElementById("codex-request-status");
  const showCodexLink = (url) => {
    if (!/^codex:\/\/threads\/[a-f0-9-]{36}$/i.test(url ?? "")) return;
    const link = document.createElement("a");
    link.href = url; link.className = "codex-chat-link"; link.textContent = "새 채팅 열기";
    codexStatus.append(" ", link);
  };
  const existingNotice = document.getElementById("notice");
  const banner = existingNotice ?? document.createElement("div");
  banner.className = "notice";
  banner.setAttribute("role", "status");
  const refresh = document.createElement("button");
  refresh.type = "button"; refresh.className = "refresh-button";
  refresh.textContent = "새로고침";
  refresh.title = "최신 파일로 새로고침";
  refresh.setAttribute("aria-label", "최신 파일로 새로고침");
  (document.querySelector("[data-refresh-slot]") ?? document.querySelector(".toolbar")).append(refresh);
  if (!existingNotice) document.querySelector("header").append(banner);
  const status = (message, error = false) => {
    banner.className = error ? "notice error" : "notice";
    const target = document.getElementById("save-status");
    banner.textContent = target && !error ? "" : message;
    if (target) target.textContent = message;
  };
  const lock = (value) => {
    for (const id of ["grid", "material-grid"]) if (document.getElementById(id)) document.getElementById(id).inert = value;
    document.getElementById("import")?.toggleAttribute("disabled", value);
    if (codexButton) codexButton.disabled = value || requesting || !reviewReady || !config.codex?.enabled;
  };
  const viewKey = "nori:local-review:view:" + location.pathname;
  function rememberView() {
    const values = Object.fromEntries(["q", "filter", "status", "age", "area", "material-state", "material-q", "material-filter"]
      .filter((id) => document.getElementById(id)).map((id) => [id, document.getElementById(id).value]));
    try { sessionStorage.setItem(viewKey, JSON.stringify({ values, materials: document.getElementById("materials-panel").getClientRects().length > 0, hash: location.hash, y: scrollY })); } catch {}
  }
  function restoreView() {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(viewKey)); sessionStorage.removeItem(viewKey); } catch {}
    if (!saved) return;
    if (/^#play_\d+$/.test(location.hash) && saved.hash !== location.hash) return;
    if (saved.materials && !document.getElementById("materials-panel").getClientRects().length) document.getElementById("materials-tab").click();
    for (const [id, value] of Object.entries(saved.values)) {
      const node = document.getElementById(id);
      if (!node) continue;
      node.value = value;
      node.dispatchEvent(new Event(node.tagName === "INPUT" ? "input" : "change", { bubbles: true }));
    }
    requestAnimationFrame(() => scrollTo(0, saved.y));
  }
  refresh.addEventListener("click", () => { rememberView(); location.reload(); });
  function fail(error) {
    if (error.status !== 400) blocked = true;
    applying = false;
    lock(blocked);
    status("저장·반영 실패: " + error.message + (blocked ? " · 현재 의견은 JSON으로 보관한 뒤 최신 화면을 열어 주세요." : " · 입력을 보완하고 다시 선택해 주세요."), true);
  }
  function enqueue(value, intent, seq) {
    saving++;
    chain = chain.then(async () => {
      if (blocked) return;
      const action = intent?.type === "play" ? "approve" : intent?.type === "material" ? "materials" : "save";
      const response = await fetch("/api/local-review/batches/" + config.batchId + "/" + action, {
        method: "POST", headers: { "content-type": "application/json", "x-nori-review-token": config.token },
        body: JSON.stringify({ revision, results: value, ...(intent ? { id: intent.id } : {}) }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw Object.assign(new Error(result.error ?? "서버에 연결하지 못했습니다."), { status: response.status });
      revision = result.revision;
      if (seq === sequence) dirty = false;
      if (intent) {
        if (intent.type === "play") {
          history.replaceState(null, "", "#" + intent.id);
          document.getElementById("filter").value = "all";
          document.getElementById("q").value = intent.id;
        }
        rememberView();
        status("로컬 반영 완료 · 최신 목록을 불러옵니다.");
        location.reload();
      } else status(seq === sequence ? "서버에 저장됨 · " + new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul" }) : "서버에 저장 중…");
    }).catch(fail).finally(() => { saving--; });
  }
  function flush() {
    clearTimeout(timer);
    if (pending) { const p = pending; pending = null; enqueue(p.value, p.intent, p.seq); }
  }
  window.noriReviewPersistence = {
    save(value, intent) {
      if (codexStatus && !requesting && config.codex?.enabled) codexStatus.textContent = "";
      dirty = true;
      sequence++;
      if (blocked) { status("최신 파일과 충돌했습니다. 현재 기록을 JSON으로 보관한 뒤 새로고침해 주세요.", true); return; }
      pending = { value: JSON.parse(JSON.stringify(value)), intent, seq: sequence };
      status(intent ? "검증 후 로컬에 반영 중…" : "서버에 저장 중…");
      if (intent) { applying = true; lock(true); flush(); }
      else { clearTimeout(timer); timer = setTimeout(flush, 250); }
    },
    ready() { reviewReady = true; restoreView(); lock(blocked || applying); },
  };
  if (codexButton) {
    if (!config.codex?.enabled) codexStatus.textContent = config.codex?.reason ?? "Codex 연결을 확인해 주세요.";
    codexButton.addEventListener("click", async () => {
      if (blocked || applying || requesting || !reviewReady || !config.codex?.enabled) return;
      requesting = true;
      lock(true);
      codexStatus.className = "codex-request-status";
      codexStatus.textContent = "검수 의견을 저장하고 새 Codex 채팅을 만들고 있습니다…";
      try {
        flush();
        await chain;
        if (blocked || dirty || pending) throw new Error("검수 의견을 먼저 저장해야 합니다. 저장 상태를 확인해 주세요.");
        const response = await fetch("/api/local-review/batches/" + config.batchId + "/codex-request", {
          method: "POST", headers: { "content-type": "application/json", "x-nori-review-token": config.token },
          body: JSON.stringify({ revision }), signal: AbortSignal.timeout(20000),
        });
        const result = await response.json();
        if (!response.ok) throw Object.assign(new Error(result.error ?? "Codex 요청을 전달하지 못했습니다."), { status: response.status, threadUrl: result.threadUrl });
        codexStatus.textContent = result.reused ? "같은 검수 요청을 받은 새 채팅이 이미 있습니다."
          : "이 수집 건의 새 검수 채팅을 만들고 요청을 보냈습니다.";
        showCodexLink(result.threadUrl);
      } catch (error) {
        if ([409, 423].includes(error.status)) fail(error);
        codexStatus.className = "codex-request-status error";
        codexStatus.textContent = error.name === "TimeoutError" || error.name === "AbortError"
          ? "전달 결과를 확인하지 못했습니다. 다시 누르기 전에 Codex 채팅을 확인해 주세요." : error.message;
        showCodexLink(error.threadUrl);
      } finally {
        requesting = false;
        lock(blocked || applying);
      }
    });
  }
  window.addEventListener("beforeunload", (event) => {
    if (dirty || requesting) { if (dirty) flush(); event.preventDefault(); event.returnValue = ""; }
  });
  status(blocked ? "중단된 거래 복구 필요: " + config.recovery.join(", ") : "로컬 서버 파일에 연결됨", blocked);
  if (blocked) lock(true);
  if (!config.batchId) restoreView();
  setInterval(async () => {
    if (document.hidden || saving || pending || applying || requesting || blocked) return;
    try {
      const response = await fetch("/api/local-review/version");
      if (!response.ok) return;
      const current = await response.json();
      if (current.revision !== revision || current.recovery.length) {
        blocked = true; lock(true);
        status("다른 화면 또는 수집 도구가 파일을 변경했습니다. 새로고침하면 최신 내용과 검수 기록을 불러옵니다.", true);
      }
    } catch { status("로컬 서버에 연결할 수 없습니다. 서버를 시작한 뒤 새로고침하세요.", true); }
  }, 5000);
})();
