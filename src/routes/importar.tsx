import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Layout } from "@/components/Layout";
import {
  detectMonth,
  diffSnapshots,
  getLoadedMonths,
  getPreviousSnapshot,
  getSnapshot,
  listSnapshots,
  normalizeRows,
  saveSnapshot,
  validate,
  type ChangeType,
  type Issue,
  type MonthlySnapshot,
  type NormalizedRow,
  type SnapshotDiff,
} from "@/lib/import-validation";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [{ title: "Importar · Fudo Churn Center" }],
  }),
  component: ImportarPage,
});

type Stage = "idle" | "review" | "confirmed";

function ImportarPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<NormalizedRow[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string>("");
  const [reprocess, setReprocess] = useState<boolean>(false);
  const [savedSnap, setSavedSnap] = useState<MonthlySnapshot | null>(null);

  const month = useMemo(() => detectMonth(rows), [rows]);
  const existingSnap = useMemo(() => (month ? getSnapshot(month) : null), [month, stage]);
  const blocking = issues.some((i) => i.severity === "error");
  const needsReprocess = !!existingSnap && !reprocess;
  const errCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warning").length;

  async function handleFile(file: File) {
    setError("");
    setStage("idle");
    setReprocess(false);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]!];
      if (!ws) throw new Error("El archivo no contiene hojas legibles.");
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (!raw.length) throw new Error("El archivo está vacío.");
      const normalized = normalizeRows(raw);
      setRows(normalized);
      setIssues(validate(normalized));
      setFileName(file.name);
      setStage("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos leer el archivo.");
    }
  }

  function reset() {
    setRows([]);
    setIssues([]);
    setFileName("");
    setStage("idle");
    setError("");
    setReprocess(false);
    setSavedSnap(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function confirm() {
    if (blocking || needsReprocess) return;
    try {
      const snap = saveSnapshot(month, rows, reprocess);
      setSavedSnap(snap);
      setStage("confirmed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar el snapshot.");
    }
  }


  return (
    <Layout>
      <section className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, marginBottom: 20 }}>
          <div>
            <h2 className="serif" style={{ fontSize: 26, margin: 0 }}>
              Importar <em>cuentas</em>
            </h2>
            <p className="fs-12" style={{ color: "var(--ink-3)", marginTop: 6 }}>
              Subí un XLSX o CSV. Validamos automáticamente antes de confirmar.
            </p>
          </div>
          {stage !== "idle" && (
            <button className="btn ghost" onClick={reset}>
              ↺ Cargar otro archivo
            </button>
          )}
        </div>

        {stage === "idle" && (
          <Dropzone onFile={handleFile} inputRef={inputRef} error={error} />
        )}

        {stage === "review" && (
          <ReviewPanel
            fileName={fileName}
            rows={rows}
            issues={issues}
            month={month}
            errCount={errCount}
            warnCount={warnCount}
            blocking={blocking}
            existingSnap={existingSnap}
            reprocess={reprocess}
            onReprocessChange={setReprocess}
            needsReprocess={needsReprocess}
            saveError={error}
            onConfirm={confirm}
            onCancel={reset}
          />
        )}

        {stage === "confirmed" && savedSnap && (
          <ConfirmedPanel snap={savedSnap} wasReprocess={reprocess} onAgain={reset} />
        )}
      </section>

      {stage === "idle" && (
        <>
          <SnapshotsList />
          <ExpectedSchema />
        </>
      )}
    </Layout>
  );
}

/* ----------------------------- subcomponents ----------------------------- */

function Dropzone({
  onFile,
  inputRef,
  error,
}: {
  onFile: (f: File) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  error: string;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 10, padding: "48px 24px",
          border: `2px dashed ${dragging ? "var(--orange)" : "var(--rule-2)"}`,
          background: dragging ? "var(--orange-tint)" : "var(--paper)",
          borderRadius: "var(--radius-md)", cursor: "pointer",
          transition: "all 120ms ease",
        }}
      >
        <div style={{ fontSize: 28 }}>↑</div>
        <div className="serif" style={{ fontSize: 20 }}>Arrastrá un archivo o hacé click</div>
        <div className="fs-12" style={{ color: "var(--ink-3)" }}>
          Formatos aceptados: .xlsx, .xls, .csv
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>

      {error && (
        <div style={{
          marginTop: 14, padding: "10px 14px", borderLeft: "3px solid var(--red)",
          background: "rgba(179,38,30,0.06)", borderRadius: 10, color: "var(--red)",
        }} className="fs-12 strong">
          {error}
        </div>
      )}
    </div>
  );
}

function ReviewPanel({
  fileName, rows, issues, month, errCount, warnCount, blocking,
  existingSnap, reprocess, onReprocessChange, needsReprocess, saveError,
  onConfirm, onCancel,
}: {
  fileName: string;
  rows: NormalizedRow[];
  issues: Issue[];
  month: string;
  errCount: number;
  warnCount: number;
  blocking: boolean;
  existingSnap: MonthlySnapshot | null;
  reprocess: boolean;
  onReprocessChange: (v: boolean) => void;
  needsReprocess: boolean;
  saveError: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const disabled = blocking || needsReprocess;
  const btnLabel = blocking
    ? "Bloqueado por errores"
    : needsReprocess
      ? "Marcá Reprocesar para sobrescribir"
      : reprocess
        ? `Reprocesar ${month} (${rows.length})`
        : `Guardar snapshot ${month} (${rows.length})`;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <SummaryStat label="Archivo" value={fileName} mono />
        <SummaryStat label="Filas detectadas" value={String(rows.length)} />
        <SummaryStat label="Mes inferido" value={month || "—"} />
        <SummaryStat
          label="Validación"
          value={blocking ? `${errCount} errores` : warnCount ? `${warnCount} avisos` : "Sin issues"}
          tone={blocking ? "red" : warnCount ? "amber" : "ok"}
        />
      </div>

      {existingSnap && (
        <div style={{
          marginBottom: 16, padding: "12px 14px", borderRadius: 10,
          background: "rgba(181,116,15,0.06)", borderLeft: "3px solid var(--amber)",
        }}>
          <div className="strong" style={{ color: "var(--amber)", fontSize: 13 }}>
            ⚠ Ya existe un snapshot para {month}
          </div>
          <div className="fs-12" style={{ color: "var(--ink-2)", marginTop: 4 }}>
            Guardado el {new Date(existingSnap.savedAt).toLocaleString()} · {existingSnap.rowCount} filas.
            Los meses pasados no se sobrescriben salvo que actives <em>reprocess month</em>.
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={reprocess}
              onChange={(e) => onReprocessChange(e.target.checked)}
            />
            <span className="fs-12 strong">Reprocesar mes (sobrescribir snapshot anterior)</span>
          </label>
        </div>
      )}

      {issues.length > 0 ? (
        <div>
          <div className="serif" style={{ fontSize: 18, marginBottom: 10 }}>
            <em>Issues</em> a revisar
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {issues.map((i, idx) => <IssueCard key={idx} issue={i} />)}
          </div>
        </div>
      ) : (
        <div style={{
          padding: 16, borderRadius: 10, background: "rgba(30,93,191,0.05)",
          borderLeft: "3px solid var(--blue)", color: "var(--blue)",
        }} className="strong">
          ✓ El archivo pasó todas las validaciones automáticas.
        </div>
      )}

      <div className="fs-12" style={{ color: "var(--ink-3)", marginTop: 16 }}>
        Meses previamente cargados:{" "}
        <span className="mono">
          {getLoadedMonths().length ? getLoadedMonths().join(", ") : "ninguno"}
        </span>
      </div>

      {saveError && (
        <div style={{
          marginTop: 12, padding: "10px 14px", borderLeft: "3px solid var(--red)",
          background: "rgba(179,38,30,0.06)", borderRadius: 10, color: "var(--red)",
        }} className="fs-12 strong">
          {saveError}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
        <button className="btn ghost" onClick={onCancel}>Cancelar</button>
        <button
          className="btn"
          onClick={onConfirm}
          disabled={disabled}
          style={{
            background: disabled ? "var(--ink-5)" : "var(--ink)",
            color: "var(--paper)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.7 : 1,
          }}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const isErr = issue.severity === "error";
  const color = isErr ? "var(--red)" : "var(--amber)";
  const bg = isErr ? "rgba(179,38,30,0.05)" : "rgba(181,116,15,0.05)";
  const preview = issue.rows?.slice(0, 8);
  const more = (issue.rows?.length ?? 0) - (preview?.length ?? 0);
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 10, background: bg,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div className="strong" style={{ color, fontSize: 13 }}>
          {isErr ? "✕" : "⚠"} {issue.title}
        </div>
        <div className="mono fs-12" style={{ color: "var(--ink-3)" }}>
          {issue.code}
        </div>
      </div>
      <div className="fs-12" style={{ color: "var(--ink-2)", marginTop: 4 }}>
        {issue.detail}
      </div>
      {preview && preview.length > 0 && (
        <div className="fs-12 mono" style={{ marginTop: 8, color: "var(--ink-3)" }}>
          Filas: {preview.join(", ")}{more > 0 ? ` … (+${more} más)` : ""}
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  label, value, mono, tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "red" | "amber" | "ok";
}) {
  const color = tone === "red" ? "var(--red)" : tone === "amber" ? "var(--amber)" : tone === "ok" ? "var(--blue)" : "var(--ink)";
  return (
    <div className="card" style={{ padding: 14, background: "var(--paper)" }}>
      <div className="fs-12" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div
        className={mono ? "mono" : "strong"}
        style={{
          marginTop: 6, fontSize: mono ? 13 : 18, color,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function ConfirmedPanel({ snap, wasReprocess, onAgain }: { snap: MonthlySnapshot; wasReprocess: boolean; onAgain: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 12px" }}>
      <div style={{ fontSize: 36, color: "var(--blue)" }}>✓</div>
      <h3 className="serif" style={{ fontSize: 22, marginTop: 8 }}>
        Snapshot <em>{wasReprocess ? "reprocesado" : "guardado"}</em>
      </h3>
      <p className="fs-12" style={{ color: "var(--ink-3)", marginTop: 6 }}>
        {snap.rowCount} filas guardadas en <span className="mono">customer_monthly_snapshot</span>
        {snap.month ? ` · mes ${snap.month}` : ""}.
      </p>
      <p className="fs-12" style={{ color: "var(--ink-4)", marginTop: 2 }}>
        {new Date(snap.savedAt).toLocaleString()}
      </p>
      <button className="btn" onClick={onAgain} style={{ marginTop: 18, background: "var(--ink)", color: "var(--paper)" }}>
        Cargar otro archivo
      </button>
    </div>
  );
}

function SnapshotsList() {
  const snaps = listSnapshots();
  if (!snaps.length) return null;
  return (
    <section className="card" style={{ padding: 24, marginTop: 16 }}>
      <h3 className="serif" style={{ fontSize: 18, margin: 0 }}>
        Snapshots <em>guardados</em>
      </h3>
      <p className="fs-12" style={{ color: "var(--ink-3)", marginTop: 4 }}>
        Cada mes queda inmutable. Para sobrescribir uno, subí el archivo de nuevo y activá <em>reprocess month</em>.
      </p>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {snaps.map((s) => (
          <div key={s.month} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 14px", borderRadius: 8, background: "var(--paper)",
            border: "1px solid var(--rule)",
          }}>
            <div>
              <div className="mono strong" style={{ fontSize: 13 }}>{s.month}</div>
              <div className="fs-12" style={{ color: "var(--ink-3)" }}>
                {s.rowCount} filas · guardado {new Date(s.savedAt).toLocaleString()}
              </div>
            </div>
            <span className="tag" style={{ background: "var(--paper-2)", color: "var(--ink-3)" }}>
              inmutable
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExpectedSchema() {
  const fields: Array<[string, string]> = [
    ["company_id",    "ID único de la cuenta (obligatorio)"],
    ["customer_name", "Nombre del cliente"],
    ["country",       "País"],
    ["segment",       "Segmento / tier"],
    ["owner",         "CSM o responsable"],
    ["plan",          "Plan contratado"],
    ["mrr",           "MRR en moneda base (número)"],
    ["status",        "active | churned"],
    ["churn_date",    "Fecha de baja (si churned)"],
    ["month",         "Mes del snapshot (ej: 2026-05)"],
  ];
  return (
    <section className="card" style={{ padding: 24, marginTop: 16 }}>
      <h3 className="serif" style={{ fontSize: 18, margin: 0 }}>
        Columnas <em>esperadas</em>
      </h3>
      <p className="fs-12" style={{ color: "var(--ink-3)", marginTop: 4 }}>
        Aceptamos variantes en español (pais, segmento, dueño, etc.). Mayúsculas y espacios se ignoran.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 14 }}>
        {fields.map(([name, desc]) => (
          <div key={name} style={{
            padding: "10px 12px", borderRadius: 8, background: "var(--paper)",
            border: "1px solid var(--rule)",
          }}>
            <div className="mono strong" style={{ fontSize: 12 }}>{name}</div>
            <div className="fs-12" style={{ color: "var(--ink-3)", marginTop: 2 }}>{desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
