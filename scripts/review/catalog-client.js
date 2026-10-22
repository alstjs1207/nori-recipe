(() => {
  const q = document.getElementById("q");
  const status = document.getElementById("status");
  const age = document.getElementById("age");
  const area = document.getElementById("area");
  const materialState = document.getElementById("material-state");
  const serverUrls = document.body.dataset.serverUrls === "true";
  const initialView = document.body.dataset.catalogView ?? "plays";
  const reviewNav = document.getElementById("reviews-nav");
  let view = "plays";
  function render() {
    if (view === "reviews") return;
    const query = q.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const card of document.querySelectorAll(view === "plays" ? ".play" : ".material")) {
      const matches = card.dataset.search.includes(query) && (view === "plays"
        ? (status.value === "all" || card.dataset.status === status.value) &&
          (age.value === "" || Number(card.dataset.ageMin) <= Number(age.value) && Number(card.dataset.ageMax) >= Number(age.value)) &&
          (!area.value || card.dataset.areas.split(",").includes(area.value))
        : materialState.value === "all" || card.dataset.state === materialState.value);
      card.hidden = !matches;
      if (matches) visible++;
    }
    document.getElementById("count").textContent = (view === "plays" ? "놀이 " : "재료 ") + visible + "개 표시";
    document.getElementById("empty").hidden = visible !== 0;
    for (const card of document.querySelectorAll("[data-catalog-status]")) card.setAttribute("aria-pressed", String(view === "plays" && status.value === card.dataset.catalogStatus));
    document.querySelector("[data-catalog-material]")?.setAttribute("aria-pressed", String(view === "materials" && materialState.value === "pending"));
  }
  function show(next) {
    view = next;
    const reviews = view === "reviews";
    const batches = document.getElementById("review-batches");
    batches.hidden = !reviews;
    if (reviews) batches.open = true;
    document.getElementById("library-panel").hidden = reviews;
    document.querySelector(".stat-grid").hidden = reviews;
    for (const [id, menu] of [["plays-tab", "plays"], ["materials-tab", "materials"], ["reviews-nav", "reviews"]]) {
      const node = document.getElementById(id);
      if (node.tagName === "BUTTON") node.setAttribute("aria-pressed", String(view === menu));
      else if (view === menu) node.setAttribute("aria-current", "page");
      else node.removeAttribute("aria-current");
    }
    document.getElementById("plays-panel").hidden = view !== "plays";
    document.getElementById("materials-panel").hidden = view !== "materials";
    for (const control of [status, age, area]) control.hidden = view !== "plays";
    materialState.hidden = view !== "materials";
    const title = { plays: "놀이 라이브러리", materials: "재료 라이브러리", reviews: "수집 건별 검수" }[view];
    document.getElementById("library-title").textContent = title;
    document.getElementById("workspace-current").textContent = title;
    document.getElementById("page-title").textContent = view === "plays" ? "놀이·재료 현황" : title;
    document.title = document.getElementById("page-title").textContent + " · nori studio";
    document.getElementById("page-description").textContent = {
      plays: "좋은 놀이를 모으고, 살펴보고, 차곡차곡 관리하세요.",
      materials: "준비물을 살펴보고, 재료마다 연결된 놀이를 확인하세요.",
      reviews: "수집한 놀이를 살펴보고, 승인한 항목을 등록하세요.",
    }[view];
    q.placeholder = view === "plays" ? "놀이명, 준비물, ID로 검색" : "재료명, 분류, slug로 검색";
    q.value = "";
    render();
  }
  if (!serverUrls) {
    document.getElementById("plays-tab").addEventListener("click", () => { show("plays"); history.replaceState(null, "", location.pathname + location.search); });
    document.getElementById("materials-tab").addEventListener("click", () => { show("materials"); history.replaceState(null, "", "#materials"); });
    reviewNav.addEventListener("click", () => { document.getElementById("review-batches").open = true; });
  }
  for (const card of document.querySelectorAll("[data-catalog-status]")) card.addEventListener("click", () => {
    if (serverUrls) { location.assign("/catalog?status=" + card.dataset.catalogStatus); return; }
    show("plays"); status.value = card.dataset.catalogStatus; age.value = ""; area.value = "";
    history.replaceState(null, "", location.pathname + location.search); render();
  });
  document.querySelector("[data-catalog-material]")?.addEventListener("click", () => {
    if (serverUrls) { location.assign("/materials?state=pending"); return; }
    show("materials"); materialState.value = "pending"; history.replaceState(null, "", "#materials"); render();
  });
  for (const control of [q, status, age, area, materialState]) control.addEventListener(control === q ? "input" : "change", render);
  document.getElementById("reset").addEventListener("click", () => { q.value = ""; status.value = "live"; age.value = ""; area.value = ""; materialState.value = "registered"; render(); });
  function openPlay(id) {
    const target = document.getElementById(id);
    if (!target?.classList.contains("play")) return;
    show("plays"); status.value = "all"; age.value = ""; area.value = ""; q.value = id;
    render(); target.open = true; target.scrollIntoView({ block: "start" });
  }
  document.getElementById("material-list").addEventListener("click", (event) => {
    const link = event.target.closest(".play-link");
    if (link && !serverUrls) { event.preventDefault(); location.hash = link.dataset.id; openPlay(link.dataset.id); }
  });
  function showLinkedItem() {
    const id = location.hash.slice(1);
    if (serverUrls && ["materials", "review-batches"].includes(id)) {
      location.replace((id === "materials" ? "/materials" : "/reviews") + location.search);
      return;
    }
    if (serverUrls && /^play_\d+$/.test(id) && initialView !== "plays") {
      location.replace("/catalog" + location.search + "#" + id);
      return;
    }
    if (id === "materials") show("materials");
    else if (id === "review-batches") { show("reviews"); scrollTo(0, 0); }
    else if (id) openPlay(id);
    else show(initialView);
  }
  if (serverUrls) {
    const params = new URLSearchParams(location.search);
    if (["live", "draft", "archived", "all"].includes(params.get("status"))) status.value = params.get("status");
    if (["registered", "pending", "replaced", "all"].includes(params.get("state"))) materialState.value = params.get("state");
  }
  window.addEventListener("hashchange", showLinkedItem);
  show(initialView);
  if (location.hash) showLinkedItem();
})();
