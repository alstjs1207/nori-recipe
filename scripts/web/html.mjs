export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function withPlayMetadata(html, play) {
  const title = escapeHtml(`${play.name} · 노리 레시피`);
  const description = escapeHtml(`${play.ageMin}~${play.ageMax}개월 · 준비 ${play.prepTime}분 · ${play.steps[0] ?? "아이와 함께 해보는 놀이"}`);
  const url = `__NORI_ORIGIN__/play/${encodeURIComponent(play.id)}`;
  const image = `__NORI_ORIGIN__/media/plays/${encodeURIComponent(play.id)}.webp`;
  const meta = `<link rel="canonical" href="${url}" /><meta property="og:type" content="article" /><meta property="og:title" content="${title}" /><meta property="og:description" content="${description}" /><meta property="og:url" content="${url}" /><meta property="og:image" content="${image}" /><meta name="twitter:card" content="summary_large_image" />`;
  return html.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]*\/>/, () => `<meta name="description" content="${description}" />`)
    .replace("</head>", () => `${meta}</head>`);
}
