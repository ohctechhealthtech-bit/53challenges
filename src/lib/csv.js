// Minimal client-side CSV builder + downloader.
// `rows` is an array of arrays (each inner array = one CSV row of cells).

function escapeCell(v) {
  if (v == null) return '';
  const s = String(v);
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