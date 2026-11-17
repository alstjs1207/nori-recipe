import { fileURLToPath } from "node:url";
import { checkTossDirectory } from "./toss/check.mjs";
console.info(await checkTossDirectory(fileURLToPath(new URL("../dist-toss/", import.meta.url))));
