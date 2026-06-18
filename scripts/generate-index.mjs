import { readdirSync, writeFileSync } from "fs";

const assets = readdirSync("dist/client/assets");
const js = assets.find((f) => f.startsWith("index-") && f.endsWith(".js"));
const css = assets.find((f) => f.endsWith(".css"));

if (!js) {
  console.error("ERROR: no index-*.js found in dist/client/assets");
  process.exit(1);
}

// TanStack Start always calls hydrateRoot which checks window.$_TSR.
// With matches:[] there is no server state — the router bootstraps
// client-side only (all data loaded via Supabase queries in the browser).
const tsrBootstrap = `self.$_TSR={p(e){this.initialized?e():this.buffer.push(e)},buffer:[],router:{matches:[]}}`;

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fudo Dashboard</title>
  ${css ? `<link rel="stylesheet" crossorigin href="/assets/${css}">` : ""}
</head>
<body>
  <script>${tsrBootstrap}</script>
  <script type="module" crossorigin src="/assets/${js}"></script>
</body>
</html>`;

writeFileSync("dist/client/index.html", html);
console.log(`✓ index.html generated → /assets/${js}`);
