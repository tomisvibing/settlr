/* Quote for CSV, and defuse cells a spreadsheet would run as a formula (text comes from other group members) */
export function csvCell(v){
  let t = String(v ?? '');
  if(/^[=+\-@\t\r]/.test(t) && !Number.isFinite(Number(t))) t = "'" + t;
  return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g,'""') + '"' : t;
}
