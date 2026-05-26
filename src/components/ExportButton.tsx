import * as XLSX from "xlsx";

export type Sheet = { name: string; rows: Record<string, unknown>[] };

type Props = {
  filename: string;
  sheets: Sheet[];
  label?: string;
};

export function ExportButton({ filename, sheets, label = "Exportar XLSX" }: Props) {
  const handleClick = () => {
    const wb = XLSX.utils.book_new();
    sheets.forEach((s) => {
      const ws = XLSX.utils.json_to_sheet(s.rows);
      // Excel limits sheet names to 31 chars and forbids some chars
      const safe = s.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, safe);
    });
    XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
  };

  return (
    <button className="btn ghost" onClick={handleClick} style={{ gap: 8 }}>
      <span style={{ fontSize: 13 }}>↓</span> {label}
    </button>
  );
}
