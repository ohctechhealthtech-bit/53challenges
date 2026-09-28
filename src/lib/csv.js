// Minimal client-side CSV builder + downloader.
// `rows` is an array of arrays (each inner array = one CSV row of cells).

/**
 * Stops a spreadsheet treating a cell as a formula.
 *
 * Excel and Google Sheets execute any cell whose text starts with =, +, -, @
 * or a control character. These exports carry entrant-supplied text — entry
 * titles, names, reasons — so without this an entrant could title their work
 * `=HYPERLINK("http://evil","Click")`, and it would run on the machine of
 * whichever admin opened the export.
 *
 * A leading apostrophe is the standard defusal: spreadsheets read the rest as
 * literal text and do not display the apostrophe itself.
 */
export function neutraliseFormula(s) {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function escapeCell(v) {
  if (v == null) return '';
  const s = neutraliseFormula(String(v));
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCSV(rows) {
  return rows
    .map((r) => (Array.isArray(r) ? r : [r]).map(escapeCell).join(','))
    .join('\r\n');
}

export function downloadCSV(filename, rows) {
  const csv = buildCSV(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
