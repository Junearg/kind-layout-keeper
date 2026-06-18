import { existsSync } from "fs";
import { execSync } from "child_process";

if (!existsSync("dist/server/server.js")) {
  console.error("ERROR: dist/server/server.js not found");
  process.exit(1);
}

// Pre-bundle the entire server (entry + all chunks + node_modules deps) into a
// single minified ESM file. This avoids wrangler re-bundling an unbundled entry
// with external imports, which would exceed the 25 MiB Pages Worker size limit.
console.log("Bundling server → dist/client/_worker.js ...");
execSync(
  [
    "node_modules/.bin/esbuild",
    "dist/server/server.js",
    "--bundle",
    "--outfile=dist/client/_worker.js",
    "--format=esm",
    "--platform=browser",
    "--conditions=workerd,worker,browser",
    "--minify",
    "--external:cloudflare:*",
    "--external:node:*",
    "--log-level=warning",
  ].join(" "),
  { stdio: "inherit" }
);

console.log("✓ _worker.js bundled (all deps inlined, ready for Pages)");
console.log("✓ Pages deployment ready");
