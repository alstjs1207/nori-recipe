import fs from "node:fs/promises";
import path from "node:path";
import { locked, safePath } from "../play-image-storage/files.mjs";

// Promote the export, SDK artifact and release metadata together, restoring all on failure.
export async function publishTossBuild(root, appName, render, { rename = fs.rename } = {}) {
  return locked(root, "generated/toss-build", async () => {
    const work = await fs.mkdtemp(path.join(safePath(root, "generated"), "toss-build-"));
    const promotions = [];
    let retain = false;
    try {
      const result = await render(work);
      for (const [i, name] of ["dist-toss", `${appName}.ait`, "generated/toss-release"].entries()) {
        const source = safePath(work, name === "generated/toss-release" ? "release" : name);
        const destination = safePath(root, name);
        const previous = path.join(work, `previous-${i}`);
        const item = { source, destination, previous, backedUp: false, promoted: false };
        promotions.push(item);
        try { await fs.lstat(destination); await rename(destination, previous); item.backedUp = true; }
        catch (error) { if (error.code !== "ENOENT") throw error; }
        await rename(source, destination); item.promoted = true;
      }
      return result;
    } catch (error) {
      try {
        for (const item of promotions.reverse()) {
          if (item.promoted) await rename(item.destination, item.source);
          if (item.backedUp) await rename(item.previous, item.destination);
        }
      } catch (restoreError) {
        retain = true;
        throw new Error(`Toss output restoration failed; previous output retained at ${work}`, { cause: restoreError });
      }
      throw error;
    } finally { if (!retain) await fs.rm(work, { recursive: true }); }
  });
}
