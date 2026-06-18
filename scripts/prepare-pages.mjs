import { writeFileSync } from "fs";

// SPA deployment: serve static files, redirect all routes to index.html
writeFileSync("dist/client/_redirects", "/* /index.html 200\n");
console.log("✓ _redirects written for SPA routing");
console.log("✓ Pages deployment ready");
