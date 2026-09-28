// Renders an audit.export payload ({ headers, rows }) to a dated CSV download.
import { neutraliseFormula } from "@/lib/csv";
function cell(v) {
  if (v === null || v === undefined) return '';
  const s = neutraliseFormula(typeof v === "object" ? JSON.stringify(v) : String(v));
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadAuditCsv(section, payload) {
  const headers = payload?.headers || Object.keys(payload?.rows?.[0] || {});
  const rows = payload?.rows || [];
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))].join('\n');
  const date = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `53-${section}-audit-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}