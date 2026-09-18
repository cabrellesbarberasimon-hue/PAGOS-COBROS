// Helpers de formateo SQL compartidos entre los generadores de SQL
// (generate-import-sql.ts y generate-sync-sql.ts).

export function sqlStr(v: string | null | undefined): string {
  if (v === null || v === undefined) return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

export function sqlNum(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "NULL";
  return String(v);
}

export function sqlDate(v: Date | null | undefined): string {
  if (!v) return "NULL";
  return `'${v.toISOString()}'`;
}

// Comparación null-safe para usar en cláusulas WHERE (dos NULL cuentan como
// iguales, al contrario que con `=`).
export function sqlEqNullSafe(column: string, value: string): string {
  return `${column} IS NOT DISTINCT FROM ${value}`;
}
