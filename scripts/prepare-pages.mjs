import { copyFileSync, existsSync, readdirSync, mkdirSync } from "fs";
import { join } from "path";

// Cloudflare Pages SSR via _worker.js:
// The plugin outputs dist/server/server.js (entry) + dist/server/assets/ (route chunks).
// Pages needs _worker.js in the output dir; its relative imports must also be there.
// Client asset hashes differ from server asset hashes, so copying both into
// dist/client/assets/ is safe (no collisions).

if (!existsSync("dist/server/server.js")) {
  console.error("ERROR: dist/server/server.js not found");
  process.exit(1);
}

copyFileSync("dist/server/server.js", "dist/client/_worker.js");
console.log("✓ _worker.js copied from dist/server/server.js");

if (existsSync("dist/server/assets")) {
  const files = readdirSync("dist/server/assets");
  mkdirSync("dist/client/assets", { recursive: true });
  for (const file of files) {
    copyFileSync(join("dist/server/assets", file), join("dist/client/assets", file));
  }
  console.log(`✓ Copied ${files.length} server assets into dist/client/assets/`);
}

console.log("✓ Pages deployment ready");
