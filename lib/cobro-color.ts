export type EstadoColorCobro = "VENCIDO" | "PROXIMO" | "OK" | "SIN_FECHA";

const DIA_MS = 24 * 60 * 60 * 1000;

// Replica el "criterio de color automático" de la hoja COBROS del Excel:
// vencido si ya pasó, próximo si vence en <= 15 días, verde en el resto.
// Se calcula siempre al vuelo, nunca se persiste.
export function estadoColorCobro(fechaVencimiento: Date | string | null | undefined): EstadoColorCobro {
  if (!fechaVencimiento) return "SIN_FECHA";

  const venc = typeof fechaVencimiento === "string" ? new Date(fechaVencimiento) : fechaVencimiento;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const v = new Date(venc);
  v.setHours(0, 0, 0, 0);

  const diffDias = Math.round((v.getTime() - hoy.getTime()) / DIA_MS);

  if (diffDias < 0) return "VENCIDO";
  if (diffDias <= 15) return "PROXIMO";
  return "OK";
}

export const COLOR_CLASSES: Record<EstadoColorCobro, { bg: string; text: string; label: string }> = {
  VENCIDO: { bg: "bg-semaforo-rojoBg", text: "text-semaforo-rojo", label: "Vencido" },
  PROXIMO: { bg: "bg-semaforo-ambarBg", text: "text-semaforo-ambar", label: "Vence en ≤15 días" },
  OK: { bg: "bg-semaforo-verdeBg", text: "text-semaforo-verde", label: "Aún no vence" },
  SIN_FECHA: { bg: "bg-slate-100", text: "text-slate-500", label: "Sin fecha" },
};
