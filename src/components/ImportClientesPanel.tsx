import { useMemo, useRef, useState } from "react";
import {
  parseClientesSheet,
  mapRowsToClientes,
  upsertClientesInBatches,
} from "@/lib/import-clientes";

type Phase = "idle" | "ready" | "reading" | "uploading" | "done" | "error";

function defaultMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ImportClientesPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mes, setMes] = useState<string>(defaultMonth());
  const [phase, setPhase] = useState<Phase>("idle");
  const [detected, setDetected] = useState<number>(0);
  const [uploaded, setUploaded] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [error, setError] = useState<string>("");

  const pct = useMemo(() => (total ? Math.round((uploaded / total) * 100) : 0), [uploaded, total]);

  function reset() {
    setFile(null); setPhase("idle"); setDetected(0); setUploaded(0); setTotal(0); setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleConfirm() {
    if (!file || !mes) return;
    setError("");
    setPhase("reading");
    try {
      const raw = await parseClientesSheet(file);
      setDetected(raw.length);
      const mapped = mapRowsToClientes(raw, mes);
      setTotal(mapped.length);
      setUploaded(0);
      if (mapped.length === 0) throw new Error("No se detectaron filas válidas (con ID Cuenta).");
      setPhase("uploading");
      await upsertClientesInBatches(mapped, (u, t) => {
        setUploaded(u); setTotal(t);
      });
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
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
            Procesamos hasta ~70k filas y hacemos upsert por <span className="mono">(ID Cuenta, mes)</span>.
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
              if (f) { setFile(f); setPhase("ready"); setError(""); }
            }}
            disabled={phase === "reading" || phase === "uploading"}
          />
          {file && (
            <span className="fs-12 mono" style={{ color: "var(--ink-2)" }}>
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
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
            disabled={!file || !mes || phase === "reading" || phase === "uploading"}
            style={{
              background: !file || !mes ? "var(--ink-5)" : "var(--orange)",
              color: "white",
              cursor: !file || !mes ? "not-allowed" : "pointer",
              opacity: !file || !mes ? 0.6 : 1,
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
              {phase === "done" && (
                <span style={{ color: "var(--green, #2e7d32)" }}>
                  ✓ Carga completa: <span className="mono strong">{uploaded}</span> filas guardadas para <span className="mono">{mes}</span>.
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
      </div>
    </section>
  );
}
