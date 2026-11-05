export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function resolvePublicOrigin(env = process.env) {
  const vercelHost = env.VERCEL_ENV === "production"
    ? env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
    : env.VERCEL_URL;
  const value = env.PUBLIC_ORIGIN || (vercelHost ? `https://${vercelHost}` : null);
  if (!value) {
    if (env.VERCEL === "1" || env.VERCEL_ENV) {
      throw new Error("Vercel 공유 주소가 필요합니다. System Environment Variables를 활성화하거나 PUBLIC_ORIGIN을 설정해 주세요.");
    }
    return null;
  }
  let url;
  try { url = new URL(value); }
  catch { throw new Error("PUBLIC_ORIGIN은 https://example.com 형태의 주소여야 합니다."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash ||
    ((env.VERCEL === "1" || env.VERCEL_ENV) && url.protocol !== "https:")) {
    throw new Error("PUBLIC_ORIGIN에는 경로·쿼리·인증 정보가 없는 origin을 지정하세요. Vercel에서는 HTTPS가 필요합니다.");
  }
  return url.origin;
}

export function withPublicOrigin(html, origin) {
  return origin ? html.replaceAll("__NORI_ORIGIN__", escapeHtml(origin)) : html;
}

function withShareMetadata(html, { title, description, url, image, type, imageDetails = "" }) {
  const meta = `<link rel="canonical" href="${url}" /><meta property="og:type" content="${type}" /><meta property="og:site_name" content="노리 레시피" /><meta property="og:locale" content="ko_KR" /><meta property="og:title" content="${title}" /><meta property="og:description" content="${description}" /><meta property="og:url" content="${url}" /><meta property="og:image" content="${image}" />${imageDetails}<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${title}" /><meta name="twitter:description" content="${description}" /><meta name="twitter:image" content="${image}" />`;
  return html.replace(/<link\b[^>]*\brel="canonical"[^>]*>/gi, "")
    .replace(/<meta\b[^>]*\b(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/gi, "")
    .replace("</head>", () => `${meta}</head>`);
}

export function withSiteMetadata(html) {
  return withShareMetadata(html, {
    title: "노리 레시피 · 우리 집 재료가, 오늘의 놀이로.",
    description: "아이의 월령과 집에 있는 재료로 오늘 함께할 놀이를 찾아보세요. 회원가입 없이 시작하는 맞춤 놀이 추천, 노리 레시피.",
    url: "__NORI_ORIGIN__/",
    image: "__NORI_ORIGIN__/og/nori-recipe-20261105-v2.jpg",
    type: "website",
    imageDetails: '<meta property="og:image:type" content="image/jpeg" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta property="og:image:alt" content="우리 집 재료가, 오늘의 놀이로. 엄마와 남자아이가 종이와 크레용으로 함께 노는 노리 레시피" />',
  });
}

export function withPlayMetadata(html, play, imageVersion) {
  const title = escapeHtml(`${play.name} · 노리 레시피`);
  const description = escapeHtml(`${play.ageMin}~${play.ageMax}개월 · 준비 ${play.prepTime}분 · ${play.steps[0] ?? "아이와 함께 해보는 놀이"}`);
  const url = `__NORI_ORIGIN__/play/${encodeURIComponent(play.id)}`;
  const image = `__NORI_ORIGIN__/media/plays/${encodeURIComponent(play.id)}.webp${imageVersion ? `?v=${encodeURIComponent(imageVersion)}` : ""}`;
  return withShareMetadata(html.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]*\/>/, () => `<meta name="description" content="${description}" />`),
  { title, description, url, image, type: "article" });
}
