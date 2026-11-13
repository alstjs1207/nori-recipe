import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { escapeHtml, withPublicOrigin } from "./html.mjs";

// 서비스 소개 페이지(/intro). 숫자는 모두 빌드 시점의 공개 놀이·재료 데이터에서 계산한다.
export const INTRO_PATH = "/intro";
export const QUICK_PREP_MINUTES = 5;

// src/constants/devAreas.ts의 순서·표시명과 같아야 한다(tests/web-intro.test.mjs에서 대조).
export const DEV_AREAS = [
  { slug: "fine_motor", label: "소근육", detail: "집고, 찢고, 붙이며 손끝을 써요" },
  { slug: "gross_motor", label: "대근육", detail: "걷고, 던지고, 균형을 잡으며 몸 전체를 써요" },
  { slug: "cognitive", label: "인지", detail: "모양·색·순서를 살피고 비교해요" },
  { slug: "language", label: "언어", detail: "이름을 붙이고 묻고 답하며 말을 나눠요" },
  { slug: "emotional", label: "정서", detail: "좋고 싫은 마음을 표현하고 나눠요" },
  { slug: "social", label: "사회성", detail: "주고받고 차례를 기다리며 함께 놀아요" },
  { slug: "sensory", label: "감각", detail: "만지고 듣고 보며 느낌을 탐색해요" },
];

// 실제 서비스 화면 캡처 원본(assets/intro). 캡처 조건은 OpenSpec change design에 기록한다.
export const INTRO_SCREENS = {
  home: { file: "home.png", alt: "노리 레시피 발견 화면. 오늘의 추천 놀이와 우리 집 재료 요약" },
  materials: { file: "materials.png", alt: "우리 집 재료를 고르는 화면. 종이·박스·스티커 등 재료 그림 목록" },
  search: { file: "search.png", alt: "탐색 화면. 월령·시간·발달영역으로 놀이를 좁혀보는 목록" },
  detailPrep: { file: "detail-prep.png", alt: "놀이 상세의 준비물 영역. 필수·선택 재료와 시작 전 확인 사항" },
  detailSafety: { file: "detail-safety.png", alt: "놀이 상세의 안전 팁 영역. 놀이별 안전 유의사항 목록" },
  favorites: { file: "favorites.png", alt: "저장한 놀이 화면. 찜해 둔 놀이 카드 목록" },
  record: { file: "record.png", alt: "놀이 기록 화면. 이번 달 함께한 놀이 수와 발달 영역별 경험" },
};

function activeMaterials(registry) {
  const pending = new Set(registry.reviewPending ?? []);
  return Object.entries(registry.categories).map(([category, slugs]) => ({
    category,
    slugs: slugs.filter((slug) => !pending.has(slug) && registry.displayNames[slug]),
  })).filter((group) => group.slugs.length > 0);
}

function ageBuckets(ageMin, ageMax) {
  const buckets = [];
  let lo = ageMin;
  while (lo <= ageMax) {
    const hi = Math.min(ageMax, (Math.floor(lo / 12) + 1) * 12);
    buckets.push({ min: lo, max: hi });
    lo = hi + 1;
  }
  return buckets;
}

export function collectIntroData({ plays, registry }) {
  const live = plays.filter((play) => play.status === "live");
  if (live.length === 0) throw new Error("소개 페이지에 표시할 공개 놀이가 없습니다.");
  const groups = activeMaterials(registry);
  const materialSlugs = groups.flatMap((group) => group.slugs);
  const materialSet = new Set(materialSlugs);
  const ageMin = Math.min(...live.map((play) => play.ageMin));
  const ageMax = Math.max(...live.map((play) => play.ageMax));
  const devAreas = DEV_AREAS.map((area) => ({ ...area, count: live.filter((play) => play.devAreas.includes(area.slug)).length }))
    .filter((area) => area.count > 0);
  const buckets = ageBuckets(ageMin, ageMax).map((bucket) => ({
    ...bucket,
    count: live.filter((play) => play.ageMin <= bucket.max && play.ageMax >= bucket.min).length,
  }));
  const usage = new Map();
  for (const play of live) for (const slug of play.materials.required) {
    if (materialSet.has(slug)) usage.set(slug, (usage.get(slug) ?? 0) + 1);
  }
  const popularMaterials = [...usage.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([slug]) => slug);
  return {
    playCount: live.length,
    quickPrepCount: live.filter((play) => play.prepTime <= QUICK_PREP_MINUTES).length,
    noMaterialCount: live.filter((play) => play.materials.required.length === 0).length,
    materialCount: materialSlugs.length,
    categoryCount: groups.length,
    ageMin,
    ageMax,
    devAreas,
    buckets,
    materialSlugs,
    popularMaterials,
    displayNames: Object.fromEntries(materialSlugs.map((slug) => [slug, registry.displayNames[slug]])),
    plays: live.map((play) => ({
      id: play.id,
      name: play.name,
      ageMin: play.ageMin,
      ageMax: play.ageMax,
      prepTime: play.prepTime,
      durationMin: play.durationMin,
      durationMax: play.durationMax,
      devAreas: play.devAreas,
      required: play.materials.required,
      hasImage: play.imageStatus !== "review",
    })),
  };
}

function versioned(url, version) {
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function phone(screen, { className = "", loading = "lazy" } = {}) {
  return `<figure class="phone ${className}"><img src="${escapeHtml(screen.src)}" alt="${escapeHtml(screen.alt)}" width="390" height="844" loading="${loading}" decoding="async" /></figure>`;
}

const STYLE = `
:root{--bg:#FAFAFE;--surface:#FFFFFF;--card:#F2EFFF;--pill:#EEEAFE;--line:#E4E3EF;--ink:#19192F;--muted:#676A83;--accent:#5846E8;--accent-ink:#FFFFFF;--warm:#FFF7EC;--coral:#FF8E86;--sage:#61D6B3;--sky:#8ACCF4;--lavender:#A884FF;--radius:24px;--font:system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
*{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);line-height:1.6;word-break:keep-all;overflow-wrap:anywhere}
img{max-width:100%;display:block}
a{color:inherit}
.wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 16px}
.skip{position:absolute;left:-999px}.skip:focus{left:16px;top:8px;z-index:20;background:var(--surface);padding:8px 12px;border-radius:8px}
header.top{position:sticky;top:0;z-index:10;background:rgba(250,250,254,.88);backdrop-filter:saturate(1.4) blur(12px);-webkit-backdrop-filter:saturate(1.4) blur(12px);border-bottom:1px solid var(--line)}
header.top .wrap{display:flex;align-items:center;gap:16px;height:60px}
.brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:18px;text-decoration:none;letter-spacing:-.02em}
.brand img{width:28px;height:28px}
header nav{display:none;gap:24px;margin-left:auto;font-size:15px;color:var(--muted)}
header nav a{text-decoration:none}header nav a:hover{color:var(--ink)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 22px;border-radius:999px;font-weight:700;font-size:16px;text-decoration:none;border:1px solid transparent;transition:transform .15s ease,box-shadow .15s ease}
.btn:focus-visible,.chip:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.btn-primary{background:var(--accent);color:var(--accent-ink);box-shadow:0 8px 20px rgba(88,70,232,.25)}
.btn-primary:hover{transform:translateY(-1px)}
.btn-ghost{background:var(--surface);border-color:var(--line);color:var(--ink)}
.btn-sm{min-height:40px;padding:0 16px;font-size:14px;margin-left:auto}
.eyebrow{display:inline-block;padding:6px 12px;border-radius:999px;background:var(--pill);color:var(--accent);font-weight:700;font-size:13px}
h1,h2,h3{letter-spacing:-.03em;line-height:1.25;margin:0}
h1{font-size:clamp(36px,9vw,60px);font-weight:800;margin-top:16px}
h1 em,h2 em{font-style:normal;color:var(--accent)}
h2{font-size:clamp(28px,6.4vw,42px);font-weight:800}
.lead{color:var(--muted);font-size:clamp(16px,2.2vw,18px);margin:16px 0 0}
section{padding:72px 0;scroll-margin-top:60px}
.bg-white{background:var(--surface)}.bg-card{background:var(--card)}.bg-warm{background:var(--warm)}
.hero{padding:40px 0 64px;overflow:hidden}
.hero-grid{display:grid;gap:40px;align-items:center}
.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.hero-note{color:var(--muted);font-size:14px;margin:12px 0 0}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:32px 0 0;padding:0;list-style:none}
.stats li{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:14px 12px}
.stats strong{display:block;font-size:clamp(22px,5vw,30px);font-weight:800;color:var(--accent);line-height:1.2}
.stats span{font-size:13px;color:var(--muted)}
.phone{margin:0 auto;width:min(300px,78vw);border-radius:40px;padding:10px;background:#19192F;box-shadow:0 30px 60px rgba(25,25,47,.18)}
.phone img{border-radius:30px;width:100%;height:auto;background:var(--bg)}
.hero-visual{position:relative}
.hero-visual::before{content:"";position:absolute;inset:8% -10% -6%;background:radial-gradient(closest-side,rgba(168,132,255,.35),transparent);z-index:-1}
.marquee{padding:56px 0;overflow:hidden}
.marquee h2{text-align:center}
.marquee .lead{text-align:center}
.rail{display:flex;gap:10px;width:max-content;margin-top:16px;animation:slide 80s linear infinite}
.rail.reverse{animation-direction:reverse}
.marquee-track{margin-top:24px;mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.mat{display:flex;align-items:center;gap:8px;padding:6px 14px 6px 6px;border-radius:999px;background:var(--surface);border:1px solid var(--line);font-size:14px;font-weight:600;white-space:nowrap}
.mat img{width:32px;height:32px;border-radius:50%;background:var(--card);object-fit:contain}
.dup{display:contents}
@keyframes slide{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.feature{display:grid;gap:40px;align-items:center}
.feature .copy p{margin:16px 0 0}
.points{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:10px}
.points li{display:flex;gap:10px;align-items:flex-start;font-size:15px}
.points li::before{content:"";flex:none;width:8px;height:8px;margin-top:9px;border-radius:50%;background:var(--accent)}
.demo{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px;box-shadow:0 18px 40px rgba(25,25,47,.06)}
.demo h3{font-size:15px;color:var(--muted);font-weight:700;margin:0 0 10px}
.demo .group+.group{margin-top:18px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{appearance:none;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:999px;padding:8px 14px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;min-height:40px}
.chip[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.result{margin-top:20px;padding-top:18px;border-top:1px dashed var(--line)}
.result-count{font-weight:800;font-size:18px;margin:0}
.result-count em{font-style:normal;color:var(--accent)}
.cards{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:10px}
.card{display:flex;gap:12px;align-items:center;padding:10px;border-radius:16px;background:var(--bg);text-decoration:none;border:1px solid transparent}
.card:hover{border-color:var(--line)}
.card img{width:64px;height:64px;border-radius:12px;object-fit:cover;background:var(--card);flex:none}
.card strong{display:block;font-size:15px;line-height:1.35}
.card span{font-size:13px;color:var(--muted)}
.empty{color:var(--muted);font-size:14px;margin:12px 0 0}
.meter{margin-top:28px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px}
.meter-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.meter-head strong{font-size:clamp(28px,6vw,40px);color:var(--accent);font-weight:800;line-height:1.1;white-space:nowrap}
.meter-head span{text-align:right}
.meter-head span{color:var(--muted);font-size:14px}
.bar{height:12px;border-radius:999px;background:var(--pill);margin-top:14px;overflow:hidden}
.bar i{display:block;height:100%;border-radius:inherit;background:var(--accent)}
.ages{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 0 0;padding:0;list-style:none}
.ages li{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px 14px;font-size:14px;color:var(--muted)}
.ages strong{display:block;color:var(--ink);font-size:18px}
.areas{list-style:none;padding:0;margin:40px 0 0;display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.areas li{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px}
.areas strong{display:flex;justify-content:space-between;align-items:baseline;font-size:17px}
.areas strong span{font-size:13px;color:var(--accent);font-weight:700}
.areas p{margin:6px 0 0;font-size:13px;color:var(--muted);line-height:1.5}
.duo{display:flex;gap:16px;justify-content:center;align-items:flex-start}
.duo .phone{width:min(240px,44vw);padding:7px;border-radius:32px}
.duo .phone img{border-radius:26px}
.duo .phone:nth-child(2){margin-top:48px}
.steps{list-style:none;padding:0;margin:0;display:grid;gap:12px;counter-reset:step}
.steps li{counter-increment:step;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px 16px 16px 60px;position:relative}
.steps li::before{content:counter(step,decimal-leading-zero);position:absolute;left:16px;top:16px;width:32px;height:32px;border-radius:50%;background:var(--pill);color:var(--accent);font-weight:800;font-size:13px;display:grid;place-items:center}
.steps strong{display:block}
.steps span{font-size:14px;color:var(--muted)}
.faq{max-width:760px}
.faq details{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:0 20px;margin-top:10px}
.faq summary{cursor:pointer;list-style:none;padding:18px 0;font-weight:700;display:flex;justify-content:space-between;gap:16px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:var(--accent);font-size:22px;line-height:1}
.faq details[open] summary::after{content:"−"}
.faq details p{margin:0 0 18px;color:var(--muted)}
.final{text-align:center;background:linear-gradient(180deg,var(--card),var(--surface))}
.final .hero-actions{justify-content:center}
footer{padding:32px 0 48px;color:var(--muted);font-size:13px;border-top:1px solid var(--line)}
footer .wrap{display:flex;flex-wrap:wrap;gap:12px 24px;justify-content:space-between}
footer nav{display:flex;gap:16px}
@media (min-width:860px){
  header nav{display:flex}.btn-sm{margin-left:8px}
  section{padding:120px 0}
  .hero{padding:72px 0 96px}
  .hero-grid,.feature{grid-template-columns:1.05fr .95fr;gap:64px}
  .feature.flip .copy{order:2}
  .stats{max-width:460px}
  .phone{width:320px}
  .ages{grid-template-columns:repeat(4,1fr)}
  .areas{grid-template-columns:repeat(4,1fr)}
  .wrap{padding:0 24px}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.rail{animation:none;flex-wrap:wrap;width:auto;justify-content:center}.rail .dup{display:none}.btn{transition:none}}
`;

const SCRIPT = `
(function(){
  var data = JSON.parse(document.getElementById('intro-data').textContent);
  var root = document.getElementById('demo');
  if (!root) return;
  var state = { bucket: data.defaultBucket, materials: new Set(data.defaultMaterials) };
  var countEl = root.querySelector('[data-count]');
  var listEl = root.querySelector('[data-list]');
  var emptyEl = root.querySelector('[data-empty]');
  function render(){
    var b = data.buckets[state.bucket];
    var matches = data.plays.filter(function(p){
      return p.ageMin <= b.max && p.ageMax >= b.min && p.required.every(function(m){ return state.materials.has(m); });
    }).sort(function(a, c){ return c.required.length - a.required.length || a.prepTime - c.prepTime || a.name.localeCompare(c.name, 'ko'); });
    countEl.textContent = matches.length;
    listEl.textContent = '';
    matches.slice(0, 3).forEach(function(p){
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'card'; a.href = '/play/' + encodeURIComponent(p.id);
      var img = document.createElement('img');
      img.src = p.thumb; img.alt = ''; img.width = 64; img.height = 64; img.loading = 'lazy';
      var box = document.createElement('div');
      var t = document.createElement('strong'); t.textContent = p.name;
      var s = document.createElement('span');
      s.textContent = p.ageMin + '–' + p.ageMax + '개월 · 준비 ' + p.prepTime + '분 · ' + p.durationMin + '–' + p.durationMax + '분';
      box.appendChild(t); box.appendChild(s); a.appendChild(img); a.appendChild(box); li.appendChild(a); listEl.appendChild(li);
    });
    emptyEl.hidden = matches.length > 0;
    root.querySelectorAll('[data-bucket]').forEach(function(el){ el.setAttribute('aria-pressed', String(Number(el.dataset.bucket) === state.bucket)); });
    root.querySelectorAll('[data-material]').forEach(function(el){ el.setAttribute('aria-pressed', String(state.materials.has(el.dataset.material))); });
  }
  root.addEventListener('click', function(event){
    var el = event.target.closest('button');
    if (!el) return;
    if (el.dataset.bucket !== undefined) state.bucket = Number(el.dataset.bucket);
    if (el.dataset.material) { var m = el.dataset.material; if (state.materials.has(m)) state.materials.delete(m); else state.materials.add(m); }
    render();
  });
  root.hidden = false;
  render();
})();
`;

export function renderIntroPage({ data, screens, playImageVersions = {}, materialImageVersions = {} }) {
  const n = (value) => escapeHtml(value.toLocaleString("ko-KR"));
  const ageLabel = `${data.ageMin}–${data.ageMax}개월`;
  const materialChip = (slug) => `<span class="mat"><img src="${escapeHtml(versioned(`/media/materials/${slug}.webp`, materialImageVersions[slug]))}" alt="" width="32" height="32" loading="lazy" />${escapeHtml(data.displayNames[slug])}</span>`;
  const half = Math.ceil(data.materialSlugs.length / 2);
  const rows = [data.materialSlugs.slice(0, half), data.materialSlugs.slice(half)];
  const rail = (slugs, reverse) => {
    const chips = slugs.map(materialChip).join("");
    return `<div class="rail${reverse ? " reverse" : ""}">${chips}<span class="dup" aria-hidden="true">${chips}</span></div>`;
  };
  const quickRatio = Math.round((data.quickPrepCount / data.playCount) * 100);
  const defaultBucket = Math.min(2, data.buckets.length - 1);
  const demoData = {
    buckets: data.buckets.map(({ min, max }) => ({ min, max })),
    defaultBucket,
    defaultMaterials: data.popularMaterials.slice(0, 4),
    plays: data.plays.map((play) => ({
      id: play.id, name: play.name, ageMin: play.ageMin, ageMax: play.ageMax, prepTime: play.prepTime,
      durationMin: play.durationMin, durationMax: play.durationMax, required: play.required,
      thumb: play.hasImage ? versioned(`/media/thumbs/${play.id}.webp`, playImageVersions[play.id]) : "/nori-icon.svg",
    })),
  };
  const title = "노리 레시피 · 집에 있는 재료로 찾는 오늘의 놀이";
  const description = `${ageLabel} 아이의 월령과 우리 집 재료로 오늘 함께할 놀이를 찾아요. 놀이 ${data.playCount}개, 준비물·순서·안전 팁까지 회원가입 없이 바로 시작하는 노리 레시피.`;
  const faqs = [
    ["회원가입을 해야 하나요?", "아니요. 웹에서 아이의 생년월만 고르면 바로 추천을 볼 수 있어요. 아이 정보는 서버로 보내지 않고 이용 중인 기기에만 저장해요."],
    ["몇 개월 아이까지 이용할 수 있나요?", `${ageLabel} 아이를 위한 놀이를 모았어요. 월령이 바뀌면 그에 맞는 놀이로 추천도 달라져요.`],
    ["앱을 설치해야 하나요?", "휴대폰과 PC의 웹 브라우저에서 바로 이용할 수 있어요. 자주 쓴다면 설정의 ‘앱처럼 이용하기’ 안내를 따라 홈 화면에 추가해 보세요."],
    ["찜과 놀이 기록은 어디에 저장되나요?", "이용 중인 기기·브라우저에 저장돼요. 계정 백업이나 기기 간 동기화는 아직 제공하지 않아서, 브라우저 저장소를 지우면 기록도 함께 사라질 수 있어요."],
    ["재료가 부족하면 어떻게 하나요?", `놀이마다 꼭 필요한 재료와 없어도 되는 재료를 나눠 보여 줘요. 필수 재료 없이 시작할 수 있는 놀이도 ${n(data.noMaterialCount)}개 있어요.`],
    ["안전은 어떻게 확인하나요?", "놀이마다 시작 전 확인할 점과 안전 팁을 함께 적어 두었어요. 작은 부품처럼 주의가 필요한 재료는 따로 안내해요. 놀이하는 동안에는 보호자가 곁에서 아이의 반응을 살펴 주세요."],
    ["마음에 드는 놀이를 공유할 수 있나요?", "놀이 상세의 공유 버튼으로 링크를 보내면, 받은 사람도 앱 설정 없이 바로 놀이 방법을 볼 수 있어요."],
  ];
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="theme-color" content="#FAFAFE" />
<link rel="icon" href="/nori-favicon.png" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="canonical" href="__NORI_ORIGIN__${INTRO_PATH}" />
<meta property="og:type" content="website" /><meta property="og:site_name" content="노리 레시피" /><meta property="og:locale" content="ko_KR" />
<meta property="og:title" content="${escapeHtml(title)}" /><meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="__NORI_ORIGIN__${INTRO_PATH}" /><meta property="og:image" content="__NORI_ORIGIN__/og/nori-recipe-20261105-v2.jpg" />
<meta property="og:image:type" content="image/jpeg" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<style>${STYLE}</style>
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<header class="top"><div class="wrap">
<a class="brand" href="${INTRO_PATH}"><img src="/nori-icon.svg" alt="" width="28" height="28" />노리 레시피</a>
<nav aria-label="소개 메뉴"><a href="#recommend">맞춤 추천</a><a href="#materials">재료</a><a href="#guide">놀이 가이드</a><a href="#record">기록</a><a href="#faq">자주 묻는 질문</a></nav>
<a class="btn btn-primary btn-sm" href="/">시작하기</a>
</div></header>
<main id="main">
<section class="hero"><div class="wrap hero-grid">
<div>
<span class="eyebrow">${escapeHtml(ageLabel)} · 집에 있는 재료로</span>
<h1>오늘은 뭐 하고 놀지?<br /><em>노리 레시피</em></h1>
<p class="lead">아이의 월령과 우리 집 재료를 고르면,<br />지금 함께하기 좋은 놀이를 추천해 드려요.</p>
<div class="hero-actions"><a class="btn btn-primary" href="/">웹에서 바로 시작하기</a><a class="btn btn-ghost" href="/search">놀이 둘러보기</a></div>
<p class="hero-note">회원가입 없이, 생년월만 고르면 시작해요.</p>
<ul class="stats" aria-label="노리 레시피 놀이 현황">
<li><strong>${n(data.playCount)}개</strong><span>함께할 놀이</span></li>
<li><strong>${n(data.materialCount)}가지</strong><span>집에 있는 재료</span></li>
<li><strong>${n(data.devAreas.length)}개</strong><span>발달 영역</span></li>
</ul>
</div>
<div class="hero-visual">${phone(screens.home, { loading: "eager" })}</div>
</div></section>

<section class="marquee bg-white" aria-labelledby="mat-title"><div class="wrap">
<h2 id="mat-title">종이 한 장, 휴지심 하나로도<br /><em>충분해요</em></h2>
<p class="lead">교구를 따로 사지 않아도 괜찮아요. 집에 있는 재료 ${n(data.materialCount)}가지로 놀이를 찾아요.</p>
</div>
<div class="marquee-track">${rail(rows[0], false)}${rail(rows[1], true)}</div>
</section>

<section id="recommend"><div class="wrap feature">
<div class="copy">
<span class="eyebrow">맞춤 추천</span>
<h2 style="margin-top:14px">월령과 재료만 고르면<br /><em>오늘의 놀이</em>가 나와요</h2>
<p class="lead">아이의 월령, 우리 집 재료, 최근에 한 놀이를 함께 살펴 오늘 해볼 놀이를 골라 드려요. 직접 골라 보세요.</p>
<ul class="points"><li>놀이 시간·준비 시간·난이도를 먼저 보고 고를 수 있어요</li><li>부족한 재료가 있으면 시작 전에 알려 드려요</li><li>아래 결과는 실제 서비스의 공개 놀이 ${n(data.playCount)}개에서 찾아요</li></ul>
</div>
<div class="demo" id="demo" hidden>
<div class="group"><h3 id="demo-age">아이 월령</h3><div class="chips" role="group" aria-labelledby="demo-age">${data.buckets.map((bucket, index) => `<button type="button" class="chip" data-bucket="${index}" aria-pressed="${index === defaultBucket}">${bucket.min}–${bucket.max}개월</button>`).join("")}</div></div>
<div class="group"><h3 id="demo-mat">우리 집 재료</h3><div class="chips" role="group" aria-labelledby="demo-mat">${data.popularMaterials.map((slug) => `<button type="button" class="chip" data-material="${escapeHtml(slug)}" aria-pressed="false">${escapeHtml(data.displayNames[slug])}</button>`).join("")}</div></div>
<div class="result" aria-live="polite"><p class="result-count">지금 바로 할 수 있는 놀이 <em data-count>0</em>개</p><ul class="cards" data-list></ul><p class="empty" data-empty hidden>재료를 하나 더 골라 보세요.</p></div>
</div>
<noscript><p class="lead">자바스크립트를 켜면 월령과 재료로 놀이를 미리 찾아볼 수 있어요. <a href="/search">놀이 둘러보기</a></p></noscript>
</div></section>

<section id="materials" class="bg-card"><div class="wrap feature flip">
<div class="copy">
<span class="eyebrow">재료로 찾기</span>
<h2 style="margin-top:14px">놀이 이름을 몰라도<br /><em>재료</em>에서 시작해요</h2>
<p class="lead">가지고 있는 재료를 그림으로 골라 두면, 그 재료로 할 수 있는 놀이를 먼저 보여 드려요. 재료는 ${n(data.categoryCount)}개 분류로 정리되어 있어요.</p>
<div class="meter">
<div class="meter-head"><strong>${n(data.quickPrepCount)}개</strong><span>준비 ${QUICK_PREP_MINUTES}분 이내 놀이 · 전체 ${n(data.playCount)}개 중 ${quickRatio}%</span></div>
<div class="bar" role="img" aria-label="전체 놀이 중 준비 ${QUICK_PREP_MINUTES}분 이내 놀이 비율 ${quickRatio}%"><i style="width:${quickRatio}%"></i></div>
</div>
</div>
<div>${phone(screens.materials)}</div>
</div></section>

<section class="bg-white"><div class="wrap feature">
<div class="copy">
<span class="eyebrow">발달 영역 탐색</span>
<h2 style="margin-top:14px">이 놀이,<br /><em>어떤 경험</em>과 이어질까요?</h2>
<p class="lead">월령·장소·재료·발달 영역으로 놀이를 좁혀 보세요. 놀이마다 연결되는 발달 영역을 함께 표시해요.</p>
<ul class="ages" aria-label="월령별 놀이 수">${data.buckets.map((bucket) => `<li><strong>${n(bucket.count)}개</strong>${bucket.min}–${bucket.max}개월</li>`).join("")}</ul>
</div>
<div>${phone(screens.search)}</div>
</div>
<div class="wrap"><ul class="areas" aria-label="발달 영역별 놀이 수">${data.devAreas.map((area) => `<li><strong>${escapeHtml(area.label)}<span>${n(area.count)}개</span></strong><p>${escapeHtml(area.detail)}</p></li>`).join("")}</ul></div>
</section>

<section id="guide" class="bg-warm"><div class="wrap feature flip">
<div class="copy">
<span class="eyebrow">놀이 가이드</span>
<h2 style="margin-top:14px">처음 해보는 놀이도<br /><em>순서대로</em> 따라 해요</h2>
<p class="lead">준비물부터 안전 확인까지, 놀이마다 같은 순서로 담았어요.</p>
<ol class="steps" style="margin-top:24px">
<li><strong>이것만 준비해요</strong><span>꼭 필요한 재료와 없어도 되는 재료, 시작 전에 확인할 점</span></li>
<li><strong>이렇게 놀아요</strong><span>단계별 진행 방법과 아이 반응에 맞춘 팁</span></li>
<li><strong>안전하게 함께해요</strong><span>놀이별 안전 유의사항과 재료별 주의 안내</span></li>
</ol>
</div>
<div class="duo">${phone(screens.detailPrep)}${phone(screens.detailSafety)}</div>
</div></section>

<section id="record" class="bg-white"><div class="wrap feature">
<div class="copy">
<span class="eyebrow">찜과 기록</span>
<h2 style="margin-top:14px">아이가 좋아했던 놀이,<br /><em>다시 꺼내 봐요</em></h2>
<p class="lead">해보고 싶은 놀이는 찜해 두고, 함께한 놀이는 별점과 아이 반응, 한 줄 메모로 남겨요. 남긴 기록은 다음 추천에 반영돼요.</p>
<ul class="points"><li>이번 달 함께한 놀이 수와 경험한 발달 영역을 한눈에 봐요</li><li>기록은 이용 중인 기기에만 저장돼요</li></ul>
</div>
<div class="duo">${phone(screens.favorites)}${phone(screens.record)}</div>
</div></section>

<section id="faq"><div class="wrap faq">
<h2>자주 묻는 질문</h2>
${faqs.map(([q, a]) => `<details><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`).join("\n")}
</div></section>

<section class="final"><div class="wrap">
<h2>아이와의 오늘,<br /><em>지금 시작해요</em></h2>
<p class="lead">생년월을 고르고 우리 집 재료를 골라 보세요.</p>
<div class="hero-actions"><a class="btn btn-primary" href="/">웹에서 바로 시작하기</a><a class="btn btn-ghost" href="/search">놀이 둘러보기</a></div>
</div></section>
</main>
<footer><div class="wrap"><span>© 노리 레시피</span><nav aria-label="바로가기"><a href="/">놀이 시작하기</a><a href="/search">놀이 탐색</a><a href="/settings">설정·이용 안내</a></nav></div></footer>
<script type="application/json" id="intro-data">${jsonForScript(demoData)}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

// 캡처 원본을 내용 해시 이름의 WebP로 변환하고 /intro/index.html을 쓴다.
export async function writeIntroPage({ root, dist, plays, registry, playImageVersions = {}, materialImageVersions = {}, publicOrigin = null }) {
  const data = collectIntroData({ plays, registry });
  const mediaDirectory = path.join(dist, "intro", "media");
  await fs.mkdir(mediaDirectory, { recursive: true });
  const screens = {};
  for (const [key, screen] of Object.entries(INTRO_SCREENS)) {
    const webp = await sharp(path.join(root, "assets", "intro", screen.file)).resize({ width: 780, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const name = `${path.basename(screen.file, ".png")}.${crypto.createHash("sha256").update(webp).digest("hex").slice(0, 12)}.webp`;
    await fs.writeFile(path.join(mediaDirectory, name), webp);
    screens[key] = { src: `${INTRO_PATH}/media/${name}`, alt: screen.alt };
  }
  const html = renderIntroPage({ data, screens, playImageVersions, materialImageVersions });
  await fs.writeFile(path.join(dist, "intro", "index.html"), withPublicOrigin(html, publicOrigin));
  return { data, screens, html };
}
