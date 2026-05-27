import { useState } from "react";
import { exportFullWorkbook } from "@/lib/export-workbook";

// Legacy prop name `sheets` kept for backwards compatibility but ignored — the
// button now always exports the full consolidated workbook with every section
// of the platform on its own styled tab.
type Props = {
  filename?: string;
  label?: string;
  sheets?: unknown;
};

export function ExportButton({
  filename = "fudo-churn-center.xlsx",
  label = "Exportar todo (XLSX)",
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exportFullWorkbook(filename);
    } catch (err) {
      console.error("[export] failed", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className="btn ghost"
      onClick={handleClick}
      disabled={busy}
      style={{ gap: 8, opacity: busy ? 0.6 : 1 }}
    >
      <span style={{ fontSize: 13 }}>↓</span> {busy ? "Generando…" : label}
    </button>
  );
}
