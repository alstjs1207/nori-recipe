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

export function withPlayMetadata(html, play, imageVersion) {
  const title = escapeHtml(`${play.name} · 노리 레시피`);
  const description = escapeHtml(`${play.ageMin}~${play.ageMax}개월 · 준비 ${play.prepTime}분 · ${play.steps[0] ?? "아이와 함께 해보는 놀이"}`);
  const url = `__NORI_ORIGIN__/play/${encodeURIComponent(play.id)}`;
  const image = `__NORI_ORIGIN__/media/plays/${encodeURIComponent(play.id)}.webp${imageVersion ? `?v=${encodeURIComponent(imageVersion)}` : ""}`;
  const meta = `<link rel="canonical" href="${url}" /><meta property="og:type" content="article" /><meta property="og:title" content="${title}" /><meta property="og:description" content="${description}" /><meta property="og:url" content="${url}" /><meta property="og:image" content="${image}" /><meta name="twitter:card" content="summary_large_image" />`;
  return html.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]*\/>/, () => `<meta name="description" content="${description}" />`)
    .replace("</head>", () => `${meta}</head>`);
}
