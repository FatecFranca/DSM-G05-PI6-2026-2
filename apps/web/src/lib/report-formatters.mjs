// Quote fields and neutralize spreadsheet formulas in imported text.
export function serializeCsv(rows) {
  return '\uFEFF' + rows.map((row) => row.map((value) => {
    let text = String(value ?? '');
    if (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  }).join(';')).join('\r\n');
}

export function formatReportDate(value) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}
