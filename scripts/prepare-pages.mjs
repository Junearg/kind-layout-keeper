import { copyFileSync, readdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

// Debug: show what's in dist/server/
console.log("=== dist/server/ contents ===");
if (existsSync("dist/server")) {
  const files = readdirSync("dist/server");
  files.forEach(f => console.log(" ", f));
  if (existsSync("dist/server/assets")) {
    console.log("  assets/");
    readdirSync("dist/server/assets").forEach(f => console.log("    ", f));
  }
} else {
  console.log("  (not found)");
}

// Find _worker.js: prefer index.js, then server.js, else look for worker-entry in assets
if (existsSync("dist/server/index.js")) {
  copyFileSync("dist/server/index.js", "dist/client/_worker.js");
  console.log("✓ _worker.js from dist/server/index.js");
} else if (existsSync("dist/server/server.js")) {
  copyFileSync("dist/server/server.js", "dist/client/_worker.js");
  // Assets import "../server.js" relative to their location, so this must also exist
  copyFileSync("dist/server/server.js", "dist/client/server.js");
  console.log("✓ _worker.js and server.js from dist/server/server.js");
} else {
  // Find worker-entry file in assets
  const assets = existsSync("dist/server/assets") ? readdirSync("dist/server/assets") : [];
  const workerEntry = assets.find(f => f.startsWith("worker-entry") || f.startsWith("server-"));
  if (workerEntry) {
    writeFileSync(
      "dist/client/_worker.js",
      `import { w } from "./assets/${workerEntry}";\nexport { w as default };\n`
    );
    console.log(`✓ _worker.js created pointing to ${workerEntry}`);
  } else {
    console.error("ERROR: Could not find worker entry file");
    console.log("Available assets:", assets);
    process.exit(1);
  }
}

// Copy dist/server/assets/* → dist/client/assets/
if (existsSync("dist/server/assets")) {
  const serverAssets = readdirSync("dist/server/assets");
  for (const file of serverAssets) {
    const src = join("dist/server/assets", file);
    const dst = join("dist/client/assets", file);
    if (!existsSync(dst)) {
      copyFileSync(src, dst);
    }
  }
  console.log(`✓ ${serverAssets.length} server assets merged`);
}

console.log("✓ Pages deployment ready");
