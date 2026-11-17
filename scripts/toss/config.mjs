import path from "node:path";

export function tossAppName(env = process.env) {
  const value = env.TOSS_APP_NAME || "nori-recipe";
  if (!/^[a-z][a-z0-9-]{0,49}$/.test(value)) throw new Error("Invalid TOSS_APP_NAME");
  return value;
}

// Approved public manifests; the shared verifier also merges registration records.
export function tossImageEnvironment(root, env = process.env) {
  const settings = {
    PLAY_IMAGE_PUBLIC_MANIFEST: "openspec/changes/migrate-play-images-to-supabase-storage/evidence/full-public-manifest-2026-11-15.json",
    PLAY_IMAGE_PUBLIC_ORIGIN: "https://clqthwgsmumiwnnqjtbe.supabase.co",
    PLAY_IMAGE_PUBLIC_BUCKET: "play-assets",
    MATERIAL_IMAGE_PUBLIC_MANIFEST: "openspec/changes/migrate-material-images-to-supabase-storage/evidence/public-manifest-2026-11-16.json",
    MATERIAL_IMAGE_PUBLIC_ORIGIN: "https://clqthwgsmumiwnnqjtbe.supabase.co",
    MATERIAL_IMAGE_PUBLIC_BUCKET: "material-assets",
  };
  for (const key of Object.keys(settings)) if (env[key]) settings[key] = env[key];
  for (const prefix of ["PLAY_IMAGE", "MATERIAL_IMAGE"]) {
    if (new URL(settings[`${prefix}_PUBLIC_ORIGIN`]).protocol !== "https:") throw new Error("Toss public images require HTTPS");
    settings[`${prefix}_PUBLIC_MANIFEST`] = path.resolve(root, settings[`${prefix}_PUBLIC_MANIFEST`]);
    if (env[`${prefix}_PUBLIC_ASSET_DIR`]) settings[`${prefix}_PUBLIC_ASSET_DIR`] = path.resolve(root, env[`${prefix}_PUBLIC_ASSET_DIR`]);
  }
  return settings;
}

export function tossExportEnvironment(env = process.env) {
  const result = Object.fromEntries(["PATH", "HOME", "TMPDIR", "TEMP", "SystemRoot", "LANG"].filter(key => env[key]).map(key => [key, env[key]]));
  return { ...result, CI: "1", EXPO_NO_TELEMETRY: "1", EXPO_NO_DOTENV: "1",
    EXPO_PUBLIC_APP_TARGET: "toss", EXPO_PUBLIC_TOSS_APP_NAME: tossAppName(env), TOSS_APP_NAME: tossAppName(env),
    TOSS_DEVTOOLS: "", EXPO_PUBLIC_GA_ENABLED: "false", EXPO_PUBLIC_GA_MEASUREMENT_ID: "",
    EXPO_PUBLIC_ANALYTICS_ORIGIN: "", EXPO_PUBLIC_ANALYTICS_PREVIEW: "false" };
}

export function tossHtml(html) {
  return html.replace(/<script\b[^>]*src=["']\/pwa\.js["'][^>]*>\s*<\/script>/gi, "")
    .replace(/<link\b[^>]*(?:rel=["'](?:manifest|apple-touch-icon|canonical)["']|href=["']\/toss\.css["'])[^>]*>/gi, "")
    .replace(/<meta\b[^>]*(?:property=["']og:[^"']+["']|name=["'](?:twitter:[^"']+|apple-mobile-web-app-capable|mobile-web-app-capable)["'])[^>]*>/gi, "")
    .replace(/<meta\b[^>]*name=["']viewport["'][^>]*>/i, '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />')
    .replace("</head>", '<link rel="stylesheet" href="/toss.css" /></head>')
    .replace("<body>", '<body data-nori-target="toss">');
}
