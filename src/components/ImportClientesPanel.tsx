import { useMemo, useRef, useState } from "react";
import {
  parseClientesSheet,
  mapRowsToClientes,
  upsertClientesInBatches,
} from "@/lib/import-clientes";
import { usePeriod } from "@/contexts/PeriodContext";

type Phase = "idle" | "ready" | "reading" | "uploading" | "done" | "error";

function defaultMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ImportClientesPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [mes, setMes] = useState<string>(defaultMonth());
  const [phase, setPhase] = useState<Phase>("idle");
  const [detected, setDetected] = useState<number>(0);
  const [uploaded, setUploaded] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ inserted: number; failed: number; read: number } | null>(null);
  const { refresh, setSelectedPeriod } = usePeriod();

  const pct = useMemo(() => (total ? Math.round((uploaded / total) * 100) : 0), [uploaded, total]);

  function appendLog(line: string) {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${ts}] ${line}`]);
    queueMicrotask(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    });
  }

  function reset() {
    setFile(null); setFileBuffer(null); setPhase("idle"); setDetected(0); setUploaded(0); setTotal(0);
    setError(""); setLogs([]); setSummary(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFileSelected(f: File) {
    setFile(f);
    setFileBuffer(null);
    setError("");
    setPhase("reading");
    // Leemos el archivo YA, mientras el permiso del navegador está vigente.
    // En archivos grandes (>20MB) el handle puede expirar si esperamos al click.
    try {
      let buf: ArrayBuffer;
      try {
        buf = await f.arrayBuffer();
      } catch {
        buf = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
          reader.readAsArrayBuffer(f);
        });
      }
      setFileBuffer(buf);
      setPhase("ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo leer el archivo.";
      setError(`${msg} Volvé a seleccionar el archivo.`);
      setPhase("error");
    }
  }

  async function handleConfirm() {
    if (!fileBuffer || !mes) return;
    setError("");
    setLogs([]);
    setSummary(null);
    setPhase("reading");
    try {
      const raw = await parseClientesSheet(fileBuffer);
      setDetected(raw.length);
      appendLog(`Filas detectadas en el Excel: ${raw.length}`);
      const mapped = mapRowsToClientes(raw, mes);
      setTotal(mapped.length);
      setUploaded(0);
      appendLog(`Filas válidas (con ID Cuenta dash) tras mapeo: ${mapped.length}`);
      if (mapped.length === 0) throw new Error("No se detectaron filas válidas con ID Cuenta (dash).");
      setPhase("uploading");
      const result = await upsertClientesInBatches(
        mapped,
        (u, t) => { setUploaded(u); setTotal(t); },
        500,
        appendLog,
      );
      setSummary({ inserted: result.totalInserted, failed: result.totalFailed, read: raw.length });
      appendLog(
        `RESUMEN — leídas: ${raw.length} · mapeadas: ${mapped.length} · ` +
        `insertadas: ${result.totalInserted} · fallidas: ${result.totalFailed}`,
      );
      setPhase("done");
      await refresh();
      setSelectedPeriod(mes);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error inesperado.";
      appendLog(`ERROR FATAL: ${msg}`);
      setError(msg);
      setPhase("error");
    }
  }



  return (
    <section className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 className="serif" style={{ fontSize: 22, margin: 0 }}>
            Importar <span className="alt">base de clientes</span> a la nube
          </h2>
          <p className="fs-12" style={{ color: "var(--ink-3)", marginTop: 6, maxWidth: 720 }}>
            Subí el XLSX original con la hoja <span className="mono">Base general</span> (headers en fila 3).
            Procesamos hasta ~70k filas y deduplicamos por <span className="mono">(ID Cuenta dash, mes)</span>.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
        {/* Step 1: file */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFileSelected(f);
            }}
            disabled={phase === "reading" || phase === "uploading"}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="btn ghost"
            onClick={() => inputRef.current?.click()}
            disabled={phase === "reading" || phase === "uploading"}
            style={{ background: "var(--paper-2)", border: "1px dashed var(--rule-2)" }}
          >
            📂 {file ? "Cambiar archivo" : "Seleccionar archivo .xlsx"}
          </button>
          {file ? (
            <span className="fs-12 mono" style={{ color: "var(--ink-2)" }}>
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
            </span>
          ) : (
            <span className="fs-12" style={{ color: "var(--ink-3)" }}>
              Ningún archivo seleccionado
            </span>
          )}
        </div>


        {/* Step 2: month */}
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="fs-11" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Mes de exportación
          </span>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            disabled={phase === "reading" || phase === "uploading"}
            style={{
              padding: "6px 10px", borderRadius: 8, border: "1px solid var(--rule-2)",
              background: "var(--paper)", fontSize: 13, color: "var(--ink)", fontFamily: "inherit",
            }}
          />
          <span className="fs-11" style={{ color: "var(--ink-3)" }}>
            (default: mes anterior)
          </span>
        </label>

        {/* Step 3: confirm */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="btn"
            type="button"
            onClick={handleConfirm}
            disabled={!fileBuffer || !mes || phase === "reading" || phase === "uploading"}
            style={{
              background: !fileBuffer || !mes ? "var(--ink-5)" : "var(--orange)",
              color: "white",
              cursor: !fileBuffer || !mes ? "not-allowed" : "pointer",
              opacity: !fileBuffer || !mes ? 0.6 : 1,
            }}
          >
            {phase === "uploading" ? "Subiendo…" : phase === "reading" ? "Leyendo…" : "Importar a Supabase"}
          </button>
          {!file && (
            <span className="fs-12" style={{ color: "var(--ink-3)" }}>
              ← Primero seleccioná un archivo .xlsx arriba
            </span>
          )}
          {(phase === "done" || phase === "error") && (
            <button className="btn ghost" type="button" onClick={reset}>Nueva carga</button>
          )}
        </div>


        {/* Progress / status */}
        {(phase === "reading" || phase === "uploading" || phase === "done") && (
          <div style={{ marginTop: 4 }}>
            <div className="fs-12" style={{ color: "var(--ink-2)", marginBottom: 6 }}>
              {phase === "reading" && "Leyendo archivo…"}
              {phase === "uploading" && (
                <>
                  Leído: <span className="mono strong">{detected}</span> filas detectadas →
                  Subiendo a Supabase: <span className="mono strong">{uploaded}/{total}</span> ({pct}%)
                </>
              )}
              {phase === "done" && summary && (
                <span style={{ color: summary.failed === 0 ? "var(--green, #2e7d32)" : "var(--orange)" }}>
                  ✓ Finalizado para <span className="mono">{mes}</span> · leídas:{" "}
                  <span className="mono strong">{summary.read}</span> · insertadas:{" "}
                  <span className="mono strong">{summary.inserted}</span>
                  {summary.failed > 0 && <> · <span className="mono strong">fallidas: {summary.failed}</span></>}
                </span>
              )}

            </div>
            <div style={{ height: 8, background: "var(--paper-2)", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${phase === "done" ? 100 : pct}%`,
                  background: "var(--orange)",
                  transition: "width 200ms ease",
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 4, padding: "10px 14px", borderLeft: "3px solid var(--red)",
            background: "rgba(179,38,30,0.06)", borderRadius: 10, color: "var(--red)",
          }} className="fs-12 strong">
            {error}
          </div>
        )}

        {logs.length > 0 && (
          <div
            ref={logRef}
            className="mono fs-11"
            style={{
              marginTop: 8,
              maxHeight: 220,
              overflowY: "auto",
              padding: "10px 12px",
              background: "var(--paper-2)",
              border: "1px solid var(--rule-2)",
              borderRadius: 8,
              whiteSpace: "pre-wrap",
              color: "var(--ink-2)",
              lineHeight: 1.5,
            }}
          >
            {logs.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
