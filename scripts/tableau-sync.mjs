/**
 * Sync mensual: descarga el MPC Database de Tableau y hace upsert en Supabase.
 *
 * Uso:
 *   node scripts/tableau-sync.mjs
 *
 * Variables de entorno requeridas (agregar al .env):
 *   TABLEAU_TOKEN_NAME   — nombre del PAT de Tableau
 *   TABLEAU_TOKEN_SECRET — secreto del PAT de Tableau
 *   TABLEAU_SITE         — contentUrl del site (ej: fudogeneral)
 *   SUPABASE_URL         — URL del proyecto Supabase
 *   SUPABASE_SERVICE_KEY — Settings > API > service_role key
 *
 * Correr 1 vez por mes, el primer día del mes siguiente al período a registrar.
 * Ej: el 1 de julio para registrar junio 2026.
 */

import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const xlsx = require("xlsx");

// ── Config ────────────────────────────────────────────────────────────────────

const TABLEAU_HOST   = "us-east-1.online.tableau.com";
const TABLEAU_API    = "/api/3.18";
const VIEW_ID        = "600729ea-f29e-4403-9b5d-52722e1b9472"; // Monthly Paying Customers Database

// Cargar .env manual (sin dotenv para evitar dependencia extra)
function loadEnv() {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)\s*=\s*"?([^"]*)"?/);
    if (m) process.env[m[1]] = m[2];
  }
}
loadEnv();

const TAB_NAME   = process.env.TABLEAU_TOKEN_NAME;
const TAB_SECRET = process.env.TABLEAU_TOKEN_SECRET;
const TAB_SITE   = process.env.TABLEAU_SITE          ?? "fudogeneral";
const SB_URL     = process.env.SUPABASE_URL          ?? process.env.VITE_SUPABASE_URL;
const SB_KEY     = process.env.SUPABASE_SERVICE_KEY;

if (!TAB_NAME || !TAB_SECRET) {
  console.error("❌  Faltan TABLEAU_TOKEN_NAME y/o TABLEAU_TOKEN_SECRET en .env");
  process.exit(1);
}
if (!SB_KEY) {
  console.error("❌  Falta SUPABASE_SERVICE_KEY en .env");
  console.error("    Obtenerla en: Supabase Dashboard → Settings → API → service_role key");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function monthKey(dateStr) {
  // "6/1/2026" → "2026-06"
  const [m, , y] = dateStr.split("/");
  return `${y}-${String(m).padStart(2, "0")}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("▶  Autenticando en Tableau...");
  const authBody = JSON.stringify({
    credentials: {
      personalAccessTokenName: TAB_NAME,
      personalAccessTokenSecret: TAB_SECRET,
      site: { contentUrl: TAB_SITE },
    },
  });

  const authRes = await httpsRequest(
    {
      hostname: TABLEAU_HOST,
      path: `${TABLEAU_API}/auth/signin`,
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "Content-Length": Buffer.byteLength(authBody) },
    },
    authBody
  );

  const authData = JSON.parse(authRes.body.toString());
  const token  = authData.credentials?.token;
  const siteId = authData.credentials?.site?.id;
  if (!token) { console.error("❌  Auth fallida:", authRes.body.toString().slice(0, 200)); process.exit(1); }
  console.log(`✓  Autenticado (siteId: ${siteId})`);

  console.log("▶  Descargando MPC Database...");
  const xlsRes = await httpsRequest({
    hostname: TABLEAU_HOST,
    path: `${TABLEAU_API}/sites/${siteId}/views/${VIEW_ID}/crosstab/excel`,
    headers: { "X-Tableau-Auth": token },
  });

  if (xlsRes.status !== 200) { console.error("❌  Download fallido:", xlsRes.status); process.exit(1); }

  const tmpFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.tmp_tableau.xlsx");
  fs.writeFileSync(tmpFile, xlsRes.body);

  const wb   = xlsx.readFile(tmpFile);
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
  fs.unlinkSync(tmpFile);

  const [headers, ...dataRows] = rows;
  const idx = (name) => headers.indexOf(name);
  console.log(`✓  ${dataRows.length} filas descargadas`);

  // Detectar mes del snapshot
  const sampleMonth = dataRows[0]?.[idx("Month Year")];
  const mes = sampleMonth ? monthKey(sampleMonth) : new Date().toISOString().slice(0, 7);
  console.log(`✓  Período detectado: ${mes}`);

  // Mapear filas al schema de Supabase
  const BATCH = 500;
  const records = dataRows.map((r) => ({
    account_id:        String(r[idx("Account ID")] ?? ""),
    mes,
    shop:              r[idx("Shop")]              ?? null,
    country:           r[idx("Country")]           ?? null,
    gmv_tier:          r[idx("GMV Tier")]          ?? null,
    status_account:    r[idx("Status Account")]    ?? null,
    commercial_status: r[idx("Commercial Status")] ?? null,
    sales_channel:     r[idx("Sales Channel")]     ?? null,
    plan_model:        r[idx("Plan Model")]        ?? null,
    id_plan:           r[idx("ID Plan")]           ?? null,
    plan:              r[idx("Plan")]              ?? null,
  })).filter((r) => r.account_id);

  console.log(`▶  Upserting ${records.length} registros en Supabase (batches de ${BATCH})...`);

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const sbBody = JSON.stringify(batch);
    const res = await httpsRequest(
      {
        hostname: new URL(SB_URL).hostname,
        path: "/rest/v1/tableau_mpcs_snapshot",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(sbBody),
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          Prefer: "resolution=merge-duplicates",
        },
      },
      sbBody
    );
    if (res.status >= 400) {
      console.error(`❌  Batch ${i}-${i + BATCH} falló (${res.status}):`, res.body.toString().slice(0, 300));
      process.exit(1);
    }
    process.stdout.write(`\r   ${Math.min(i + BATCH, records.length)} / ${records.length}`);
  }

  console.log(`\n✓  Sync completo — mes ${mes}, ${records.length} cuentas guardadas`);
  console.log(`\n📊 Resumen del período:`);
  const byCat = {};
  records.forEach((r) => { byCat[r.status_account] = (byCat[r.status_account] ?? 0) + 1; });
  Object.entries(byCat).forEach(([k, v]) => console.log(`   ${k}: ${v}`));
}

main().catch((e) => { console.error("❌ Error:", e); process.exit(1); });
