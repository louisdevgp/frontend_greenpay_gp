import * as XLSX from "xlsx";

function normalizeValue(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

export function exportRowsToExcel({
  rows = [],
  columns = [],
  filename = "export.xlsx",
  sheetName = "Donnees",
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeColumns = Array.isArray(columns) ? columns : [];

  const data = safeRows.map((row) => {
    const out = {};
    for (const col of safeColumns) {
      const header = String(col?.header || col?.key || "");
      if (!header) continue;
      const raw = typeof col?.value === "function" ? col.value(row) : row?.[col?.key];
      out[header] = normalizeValue(raw);
    }
    return out;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, String(sheetName || "Donnees"));
  XLSX.writeFile(workbook, filename);
}
