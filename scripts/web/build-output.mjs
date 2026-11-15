import fs from "node:fs/promises";
import path from "node:path";
import { locked, safePath } from "../play-image-storage/files.mjs";

// Render and validate in isolation. Only a complete output replaces the old one.
export async function publishWebBuild(root, render, { rename = fs.rename } = {}) {
  return locked(root, "generated/play-image-storage/web-output", async () => {
    const generated = safePath(root, "generated");
    const destination = safePath(root, "dist");
    const work = await fs.mkdtemp(path.join(generated, "web-build-"));
    const next = path.join(work, "next"), previous = path.join(work, "previous");
    let backedUp = false, promoted = false;
    try {
      await fs.mkdir(next);
      const result = await render(next);
      let exists = false;
      try { await fs.lstat(destination); exists = true; }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (exists) { await rename(destination, previous); backedUp = true; }
      try { await rename(next, destination); promoted = true; }
      catch (error) {
        if (backedUp) { await rename(previous, destination); backedUp = false; }
        throw error;
      }
      return result;
    } finally {
      // Never remove a previous output if restoration itself failed.
      if (backedUp && !promoted) throw new Error(`Previous web output retained at ${previous}`);
      await fs.rm(work, { recursive: true });
    }
  });
}
