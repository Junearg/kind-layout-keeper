import { existsSync } from "fs";

// With @cloudflare/vite-plugin in Pages mode (pages_build_output_dir set in wrangler.jsonc),
// vite build writes _worker.js directly into dist/client. Just verify it landed.
if (!existsSync("dist/client/_worker.js")) {
  console.error("ERROR: dist/client/_worker.js not found");
  console.error("Make sure wrangler.jsonc has pages_build_output_dir: dist/client");
  process.exit(1);
}
console.log("✓ _worker.js present — SSR routing ready");
console.log("✓ Pages deployment ready");
