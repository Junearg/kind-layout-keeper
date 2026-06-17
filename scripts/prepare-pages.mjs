import { copyFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

// Copy dist/server/index.js → dist/client/_worker.js
copyFileSync("dist/server/index.js", "dist/client/_worker.js");
console.log("✓ _worker.js copied");

// Copy dist/server/assets/* → dist/client/assets/
const serverAssets = readdirSync("dist/server/assets");
for (const file of serverAssets) {
  const src = join("dist/server/assets", file);
  const dst = join("dist/client/assets", file);
  if (!existsSync(dst)) {
    copyFileSync(src, dst);
  }
}
console.log(`✓ ${serverAssets.length} server assets merged`);
console.log("✓ Pages deployment ready");
