import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Layout } from "@/components/Layout";
import { downloadTemplate } from "@/lib/template-workbook";
import { parseTemplateWorkbook, type ParseReport } from "@/lib/parse-workbook-v2";
import { clearDataset, setDataset, useDataset, useMesesDisponibles } from "@/data/dataset-store";
import type { DashboardDataset } from "@/data/schema";
import { mesLargo } from "@/data/schema";

export const Route = createFileRoute("/importar")({
  head: () => ({ meta: [{ title: "Importar · Fudo Churn Center" }] }),
  component: ImportarPage,
});

type Stage = "idle" | "preview";

function ImportarPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ dataset: DashboardDataset; report: ParseReport } | null>(null);
  const [mesElegido, setMesElegido] = useState<string>("");

  const dsActual = useDataset();
  const mesesActuales = useMesesDisponibles();

  async function handleFile(file: File) {
    setError("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const out = parseTemplateWorkbook(wb, file.name);
      if (out.report.total_filas === 0) throw new Error("No encontramos filas en ninguna de las hojas esperadas.");
      const meses = out.dataset.meta.meses_disponibles;
      setMesElegido(meses[meses.length - 1] ?? "");
      setPreview(out);
      setFileName(file.name);
      setStage("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos leer el archivo.");
    }
  }

  function confirmar() {
    if (!preview) return;
    setDataset(preview.dataset, mesElegido || undefined);
    reset();
  }
  function reset() {
    setStage("idle"); setPreview(null); setFileName(""); setError(""); setMesElegido("");
    if (inputRef.current) inputRef.current.value = "";
  }


  return (
    <Layout>
      {/* Plantilla */}
      <section className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <h2 className="serif" style={{ fontSize: 22, margin: 0 }}>
              1. Descargá la <span className="alt">plantilla</span>
            </h2>
            <p className="fs-12" style={{ color: "var(--ink-3)", marginTop: 6, maxWidth: 620 }}>
              XLSX con una hoja <span className="mono">INSTRUCCIONES</span> que documenta cada campo y 12 hojas de datos
              (resumen mensual, tendencia, motivos, NPS, health score, cola CS, KPIs e iniciativas).
            </p>
          </div>
          <button className="btn" onClick={() => downloadTemplate()}
            style={{ background: "var(--orange)", color: "white" }}>
            ↓ Descargar plantilla XLSX
          </button>
        </div>
      </section>

      {/* Dropzone */}
      <section className="card" style={{ padding: 24, marginTop: 16 }}>
        <h2 className="serif" style={{ fontSize: 22, margin: 0 }}>
          2. Subí el <span className="alt">archivo</span> del mes
        </h2>
        <p className="fs-12" style={{ color: "var(--ink-3)", marginTop: 6 }}>
          Soltá el XLSX completo. Detectamos cada hoja por nombre y validamos campos. La app sigue funcionando aunque alguna hoja venga vacía.
        </p>

        {stage === "idle" && <Dropzone onFile={handleFile} inputRef={inputRef} error={error} />}

        {stage === "preview" && preview && (
          <PreviewPanel fileName={fileName} report={preview.report} onConfirm={confirmar} onCancel={reset} />
        )}
      </section>

      {/* Estado actual */}
      <section className="card" style={{ padding: 24, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 className="serif" style={{ fontSize: 22, margin: 0 }}>
              Dataset <span className="alt">actual</span>
            </h2>
            <p className="fs-12" style={{ color: "var(--ink-3)", marginTop: 6 }}>
              <span className="mono">{dsActual.meta.source_filename}</span> · subido{" "}
              {new Date(dsActual.meta.uploaded_at).toLocaleString("es-AR")}
            </p>
            <div className="fs-12" style={{ color: "var(--ink-2)", marginTop: 8 }}>
              Meses disponibles:{" "}
              <span className="mono">
                {mesesActuales.length ? mesesActuales.map(mesLargo).join(" · ") : "ninguno"}
              </span>
            </div>
          </div>
          <button className="btn ghost" onClick={() => { if (confirm("¿Volver al dataset semilla?")) { clearDataset(); location.reload(); } }}>
            Limpiar dataset
          </button>
        </div>
      </section>
    </Layout>
  );
}

function Dropzone({ onFile, inputRef, error }: { onFile: (f: File) => void; inputRef: React.RefObject<HTMLInputElement | null>; error: string }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div style={{ marginTop: 14 }}>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files?.[0]; if (f) onFile(f);
        }}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 8, padding: "44px 24px",
          border: `2px dashed ${dragging ? "var(--orange)" : "var(--rule-2)"}`,
          background: dragging ? "rgba(240,90,40,0.05)" : "var(--paper)",
          borderRadius: 12, cursor: "pointer",
        }}>
        <div style={{ fontSize: 28 }}>↑</div>
        <div className="serif" style={{ fontSize: 18 }}>Arrastrá el XLSX o hacé click</div>
        <div className="fs-12" style={{ color: "var(--ink-3)" }}>Solo .xlsx generado desde la plantilla</div>
        <input ref={inputRef} type="file" accept=".xlsx" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      </label>
      {error && (
        <div style={{ marginTop: 14, padding: "10px 14px", borderLeft: "3px solid var(--red)",
          background: "rgba(179,38,30,0.06)", borderRadius: 10, color: "var(--red)" }} className="fs-12 strong">
          {error}
        </div>
      )}
    </div>
  );
}

function PreviewPanel({ fileName, report, onConfirm, onCancel }: {
  fileName: string; report: ParseReport; onConfirm: () => void; onCancel: () => void;
}) {
  const errores = report.hojas.filter((h) => h.status === "error").length;
  const warns = report.hojas.filter((h) => h.status === "warn").length;
  const missing = report.hojas.filter((h) => h.status === "missing").length;
  return (
    <div style={{ marginTop: 14 }}>
      <div className="fs-12" style={{ color: "var(--ink-3)", marginBottom: 12 }}>
        <span className="mono strong">{fileName}</span> · {report.total_filas} filas totales
        {warns ? ` · ${warns} hojas con warnings` : ""}
        {missing ? ` · ${missing} hojas faltantes` : ""}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {report.hojas.map((h) => {
          const tone = h.status === "ok" ? "var(--blue)"
            : h.status === "warn" ? "var(--amber)"
            : h.status === "missing" ? "var(--ink-3)"
            : "var(--red)";
          const bg = h.status === "ok" ? "rgba(30,93,191,0.04)"
            : h.status === "warn" ? "rgba(181,116,15,0.06)"
            : h.status === "missing" ? "var(--paper-2)"
            : "rgba(179,38,30,0.06)";
          return (
            <div key={h.sheet} style={{ padding: 12, borderLeft: `3px solid ${tone}`, background: bg, borderRadius: 8 }}>
              <div className="mono strong" style={{ fontSize: 12 }}>{h.sheet}</div>
              <div className="fs-12" style={{ color: "var(--ink-2)", marginTop: 4 }}>
                {h.status === "missing" ? "hoja no incluida" : `${h.rows_parseadas} filas`}
              </div>
              {h.campos_faltantes.length > 0 && (
                <div className="fs-12" style={{ color: "var(--amber)", marginTop: 4 }}>
                  Faltan: {h.campos_faltantes.join(", ")}
                </div>
              )}
              {h.errores.length > 0 && (
                <div className="fs-12" style={{ color: "var(--red)", marginTop: 4 }}>
                  {h.errores.length} errores
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
        <button className="btn ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn" onClick={onConfirm} disabled={errores > 0}
          style={{ background: errores ? "var(--ink-5)" : "var(--ink)", color: "var(--paper)" }}>
          Importar y reemplazar dataset
        </button>
      </div>
    </div>
  );
}
