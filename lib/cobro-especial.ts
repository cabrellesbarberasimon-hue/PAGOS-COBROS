import { CategoriaCobroEspecial } from "@prisma/client";

const LABELS: Record<CategoriaCobroEspecial, string> = {
  INSIGNIFICANTE_INACTIVO: "Insignificante / cliente inactivo",
  DUDOSO_COBRO: "Dudoso cobro",
  ACTIVO_PENDIENTE: "Cliente activo, pendiente",
  FALTA_ABONO: "Falta por hacer abono",
  ABONO_PENDIENTE: "Abono pendiente de pagar",
  PENDIENTE_REVISAR: "Pendiente de revisar",
};

export function categoriaLabel(c: CategoriaCobroEspecial): string {
  return LABELS[c];
}
