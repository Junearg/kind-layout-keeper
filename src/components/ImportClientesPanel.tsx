import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  parseClientesSheet,
  mapRowsToClientes,
  replaceClientesInBatches,
} from "@/lib/import-clientes";
import { usePeriod } from "@/contexts/PeriodContext";
import { useCountry } from "@/contexts/CountryContext";
import { computeKpiDia } from "@/data/supabase-kpis-diarios";

type Phase = "idle" | "ready" | "reading" | "uploading" | "done" | "error";
type Modo = "mensual" | "diario";

function defaultMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type DeltaKpi = {
  fecha: string;
  activas: number; deltaActivas: number;
  bajas: number; deltaBajas: number;
  aRecuperar: number; deltaRecuperar: number;
  churnNeto: number; deltaChurn: number;
};

export function ImportClientesPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const [modo, setModo] = useState<Modo>("diario");
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [mes, setMes] = useState<string>(defaultMonth());
  const [fecha, setFecha] = useState<string>(todayISO());
  const [phase, setPhase] = useState<Phase>("idle");
  const [detected, setDetected] = useState<number>(0);
  const [uploaded, setUploaded] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ inserted: number; failed: number; read: number } | null>(null);
  const [deltaKpi, setDeltaKpi] = useState<DeltaKpi | null>(null);

  const { refresh, setSelectedPeriod } = usePeriod();
  const { selectedPais } = useCountry();
  const queryClient = useQueryClient();

  const periodoActivo = modo === "diario" ? fecha : mes;

  const pct = useMemo(() => (total ? Math.round((uploaded / total) * 100) : 0), [uploaded, total]);

  function appendLog(line: string) {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${ts}] ${line}`]);
    queueMicrotask(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    });
  }

  function reset() {
    setFile(null);
    setFileBuffer(null);
    setPhase("idle");
    setDetected(0);
    setUploaded(0);
    setTotal(0);
    setError("");
    setLogs([]);
    setSummary(null);
    setDeltaKpi(null);
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
    if (!fileBuffer || !periodoActivo) return;
    setError("");
    setLogs([]);
    setSummary(null);
    setDeltaKpi(null);
    setPhase("reading");
    try {
      const raw = await parseClientesSheet(fileBuffer);
      setDetected(raw.length);
      appendLog(`Filas detectadas en el Excel: ${raw.length}`);
      const mapped = mapRowsToClientes(raw, periodoActivo);
      setTotal(mapped.length);
      setUploaded(0);
      appendLog(`Filas válidas (con ID Cuenta dash) tras mapeo: ${mapped.length}`);
      if (mapped.length === 0)
        throw new Error("No se detectaron filas válidas con ID Cuenta (dash).");
      setPhase("uploading");
      appendLog(`Modo reemplazo: se borrará la carga previa de ${periodoActivo} antes de insertar.`);
      const result = await replaceClientesInBatches(
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

      // Para imports diarios, calcular delta vs día anterior
      if (modo === "diario") {
        appendLog("Calculando delta vs día anterior…");
        try {
          const hoyKpi = await computeKpiDia(fecha, selectedPais);
          const ayer = new Date(fecha);
          ayer.setUTCDate(ayer.getUTCDate() - 1);
          const ayerKpi = await computeKpiDia(ayer.toISOString().slice(0, 10), selectedPais);
          setDeltaKpi({
            fecha,
            activas:     hoyKpi.activas,     deltaActivas:     hoyKpi.activas     - ayerKpi.activas,
            bajas:       hoyKpi.bajas,       deltaBajas:       hoyKpi.bajas       - ayerKpi.bajas,
            aRecuperar:  hoyKpi.aRecuperar,  deltaRecuperar:   hoyKpi.aRecuperar  - ayerKpi.aRecuperar,
            churnNeto:   hoyKpi.churnNeto,   deltaChurn:       hoyKpi.churnNeto   - ayerKpi.churnNeto,
          });
        } catch { /* si no hay datos de ayer, delta se omite */ }
      }

      setPhase("done");
      await refresh();
      setSelectedPeriod(periodoActivo);
      await queryClient.invalidateQueries();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error inesperado.";
      appendLog(`ERROR FATAL: ${msg}`);
      setError(msg);
      setPhase("error");
    }
  }

  const nfmt = (n: number) => Math.abs(n).toLocaleString("es-AR");
  const sign = (n: number) => n > 0 ? "+" : n < 0 ? "" : "";
  const deltaColor = (n: number, invertido = false) => {
    if (n === 0) return "var(--ink-3)";
    const malo = invertido ? n < 0 : n > 0;
    return malo ? "var(--red)" : "#2f7d4f";
  };

  return (
    <section className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 className="serif" style={{ fontSize: 22, margin: 0 }}>
            Importar <span className="alt">base de clientes</span> a la nube
          </h2>
          <p className="fs-12" style={{ color: "var(--ink-3)", marginTop: 6, maxWidth: 720 }}>
            Subí el XLSX original con la hoja <span className="mono">Base general</span> (headers en fila 3).
            Modo diario: se usa la fecha de hoy como snapshot. Modo mensual: elegís el mes.
          </p>
        </div>
        {/* Toggle modo */}
        <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--rule-2)", alignSelf: "flex-start" }}>
          {(["diario", "mensual"] as Modo[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setModo(m); reset(); }}
              style={{
                padding: "7px 16px", border: 0, cursor: "pointer", fontFamily: "inherit",
                fontSize: 12.5, fontWeight: modo === m ? 600 : 400,
                background: modo === m ? "var(--orange)" : "var(--paper)",
                color: modo === m ? "white" : "var(--ink-2)",
                transition: "all 0.15s",
              }}
            >
              {m === "diario" ? "📅 Diario (hoy)" : "📆 Mensual"}
            </button>
          ))}
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

        {/* Step 2: fecha */}
        {modo === "diario" ? (
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="fs-11" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Fecha del snapshot
            </span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={phase === "reading" || phase === "uploading"}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--paper)", fontSize: 13, color: "var(--ink)", fontFamily: "inherit" }}
            />
            <span className="fs-11" style={{ color: "var(--ink-3)" }}>(default: hoy)</span>
          </label>
        ) : (
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="fs-11" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Mes de exportación
            </span>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              disabled={phase === "reading" || phase === "uploading"}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--paper)", fontSize: 13, color: "var(--ink)", fontFamily: "inherit" }}
            />
            <span className="fs-11" style={{ color: "var(--ink-3)" }}>(default: mes anterior)</span>
          </label>
        )}

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
            {phase === "uploading" ? "Subiendo…" : phase === "reading" ? "Leyendo…" : "Nueva carga"}
          </button>
          {!file && (
            <span className="fs-12" style={{ color: "var(--ink-3)" }}>
              ← Primero seleccioná un archivo .xlsx arriba
            </span>
          )}
          <button
            className="btn ghost"
            type="button"
            onClick={reset}
            disabled={phase === "reading" || phase === "uploading"}
          >
            Limpiar selección
          </button>
        </div>

        {/* Progress / status */}
        {(phase === "reading" || phase === "uploading" || phase === "done") && (
          <div style={{ marginTop: 4 }}>
            <div className="fs-12" style={{ color: "var(--ink-2)", marginBottom: 6 }}>
              {phase === "reading" && "Leyendo archivo…"}
              {phase === "uploading" && (
                <>
                  Leído: <span className="mono strong">{detected}</span> filas detectadas → Subiendo
                  a Supabase:{" "}
                  <span className="mono strong">
                    {uploaded}/{total}
                  </span>{" "}
                  ({pct}%)
                </>
              )}
              {phase === "done" && summary && (
                <span
                  style={{
                    color: summary.failed === 0 ? "var(--green, #2e7d32)" : "var(--orange)",
                  }}
                >
                  ✓ Finalizado para <span className="mono">{mes}</span> · leídas:{" "}
                  <span className="mono strong">{summary.read}</span> · insertadas:{" "}
                  <span className="mono strong">{summary.inserted}</span>
                  {summary.failed > 0 && (
                    <>
                      {" "}
                      · <span className="mono strong">fallidas: {summary.failed}</span>
                    </>
                  )}
                </span>
              )}
            </div>
            <div
              style={{
                height: 8,
                background: "var(--paper-2)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
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
          <div
            style={{
              marginTop: 4,
              padding: "10px 14px",
              borderLeft: "3px solid var(--red)",
              background: "rgba(179,38,30,0.06)",
              borderRadius: 10,
              color: "var(--red)",
            }}
            className="fs-12 strong"
          >
            {error}
          </div>
        )}

        {logs.length > 0 && (
          <div
            ref={logRef}
            className="mono fs-11"
            style={{ marginTop: 8, maxHeight: 220, overflowY: "auto", padding: "10px 12px", background: "var(--paper-2)", border: "1px solid var(--rule-2)", borderRadius: 8, whiteSpace: "pre-wrap", color: "var(--ink-2)", lineHeight: 1.5 }}
          >
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}

        {/* Delta vs día anterior (solo modo diario) */}
        {deltaKpi && phase === "done" && (
          <div style={{ marginTop: 8, padding: "16px 18px", background: "var(--paper-2)", borderRadius: 12, border: "1px solid var(--rule-2)" }}>
            <div className="fs-11" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              Delta vs día anterior · {deltaKpi.fecha}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                { label: "Activas", val: deltaKpi.activas, delta: deltaKpi.deltaActivas, inv: false },
                { label: "Bajas", val: deltaKpi.bajas, delta: deltaKpi.deltaBajas, inv: true },
                { label: "A Recuperar", val: deltaKpi.aRecuperar, delta: deltaKpi.deltaRecuperar, inv: true },
                { label: "Churn Neto", val: deltaKpi.churnNeto, delta: deltaKpi.deltaChurn, inv: true, pct: true },
              ].map(({ label, val, delta, inv, pct }) => (
                <div key={label} style={{ background: "var(--card)", borderRadius: 10, padding: "12px 14px" }}>
                  <div className="fs-11 muted" style={{ marginBottom: 4 }}>{label}</div>
                  <div className="mono strong" style={{ fontSize: 20 }}>
                    {pct ? `${val.toFixed(2)}%` : val.toLocaleString("es-AR")}
                  </div>
                  <div className="mono fs-11" style={{ color: deltaColor(delta, inv), marginTop: 4 }}>
                    {delta !== 0 ? `${sign(delta)}${pct ? delta.toFixed(2) + "%" : nfmt(delta)}` : "sin cambio"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
