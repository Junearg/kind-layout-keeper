import { copyFileSync, existsSync } from "fs";

// SPA routing on Cloudflare Pages: copy index.html as 404.html.
// When a route has no matching static file, Cloudflare serves 404.html,
// which bootstraps React and lets the client-side router take over.
if (!existsSync("dist/client/index.html")) {
  console.error("ERROR: dist/client/index.html not found");
  process.exit(1);
}
copyFileSync("dist/client/index.html", "dist/client/404.html");
console.log("✓ 404.html created for SPA routing");
console.log("✓ Pages deployment ready");
