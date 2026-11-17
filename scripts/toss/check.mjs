import fs from "node:fs/promises";
import path from "node:path";

export async function tossFiles(directory, prefix = "") {
  const entries = await fs.readdir(path.join(directory, prefix), { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected bundle symlink: ${name}`);
    return entry.isDirectory() ? tossFiles(directory, name) : [{ name, bytes: (await fs.stat(path.join(directory, name))).size }];
  }))).flat();
}

export async function checkTossDirectory(directory) {
  const files = await tossFiles(directory);
  const bytes = files.reduce((total, file) => total + file.bytes, 0);
  if (bytes > 100_000_000) throw new Error(`Toss bundle exceeds 100MB: ${bytes}`);
  for (const { name } of files) {
    const expoAsset = /^assets\/.+\.(?:ttf|woff2?|png|webp|svg)$/.test(name);
    if (!expoAsset && /(?:^|\/)(?:\.[^/]+|node_modules|generated|results|tools)(?:\/|$)|\.(?:map|jpe?g)$|(?:^|\/)(?:pwa\.js|sw\.js|manifest\.webmanifest)$/.test(name)) throw new Error(`Private, debug or PWA file in Toss bundle: ${name}`);
    if (/\.(?:js|html|css|json)$/.test(name)) {
      const text = await fs.readFile(path.join(directory, name), "utf8");
      if (/__aitDevtools|__ait_storage:|sourceMappingURL=|sb_secret_[A-Za-z0-9_]+|SUPABASE_SERVICE_ROLE_KEY\s*[:=]/.test(text)) throw new Error(`Debug code or credentials in Toss bundle: ${name}`);
    }
  }
  const html = await fs.readFile(path.join(directory, "index.html"), "utf8");
  if (!html.includes('data-nori-target="toss"') || !html.includes('href="/toss.css"') || !html.includes("user-scalable=no") || /pwa\.js|rel="manifest"|rel="canonical"/.test(html)) throw new Error("Invalid Toss entry HTML");
  const scripts = files.filter(file => file.name.endsWith(".js"));
  const texts = await Promise.all(scripts.map(file => fs.readFile(path.join(directory, file.name), "utf8")));
  if (!texts.some(text => text.includes("nori-recipe/toss/v1/"))) throw new Error("Toss runtime is missing from the bundle");
  return { bytes, files: files.length, scripts: scripts.length };
}
