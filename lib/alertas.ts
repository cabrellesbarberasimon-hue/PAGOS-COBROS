import type { Cobro, EntidadFinanciera, Pago, ProductoFinanciero, SupuestoTesoreria } from "@prisma/client";
import { prisma } from "./prisma";
import { calcularInforme, type AlertaInforme } from "./informe";
import { toNumber } from "./format";

// Centro de alertas: combina las alertas de ratios del Informe de posición
// (lib/informe.ts) con alertas de saldo bajo por cuenta bancaria y
// sugerencias de traspaso entre cuentas, calculadas aquí a partir del
// "disponible" y el "umbralSaldoMinimo" de cada ProductoFinanciero.

const TIPOS_CON_SALDO = new Set(["CUENTA", "POLIZA_CREDITO", "LINEA_DESCUENTO"]);

type ProductoConEntidad = ProductoFinanciero & { entidad: EntidadFinanciera };

export interface AlertaSaldoBanco {
  entidad: string;
  producto: string;
  saldo: number;
  umbral: number;
  deficit: number;
}

export interface SugerenciaTraspaso {
  desdeEntidad: string;
  desdeProducto: string;
  haciaEntidad: string;
  haciaProducto: string;
  importe: number;
}

export interface CentroAlertas {
  alertasInforme: AlertaInforme[]; // solo las que están incumplidas (ok === false)
  alertasSaldo: AlertaSaldoBanco[];
  sugerenciasTraspaso: SugerenciaTraspaso[];
  total: number;
}

export function calcularAlertasSaldo(productos: ProductoConEntidad[]): {
  alertasSaldo: AlertaSaldoBanco[];
  sugerenciasTraspaso: SugerenciaTraspaso[];
} {
  const cuentas = productos.filter((p) => TIPOS_CON_SALDO.has(p.tipo) && p.umbralSaldoMinimo !== null);

  const alertasSaldo: AlertaSaldoBanco[] = [];
  const deficitarias: Array<{ producto: ProductoConEntidad; deficit: number }> = [];
  const superavitarias: Array<{ producto: ProductoConEntidad; superavit: number }> = [];

  for (const p of cuentas) {
    const saldo = toNumber(p.disponible);
    const umbral = toNumber(p.umbralSaldoMinimo);
    if (saldo < umbral) {
      const deficit = umbral - saldo;
      alertasSaldo.push({ entidad: p.entidad.nombre, producto: p.nombre, saldo, umbral, deficit });
      deficitarias.push({ producto: p, deficit });
    } else if (saldo > umbral) {
      superavitarias.push({ producto: p, superavit: saldo - umbral });
    }
  }

  // Cubre cada déficit con las cuentas en superávit disponibles (de mayor a
  // menor superávit), sin dejar a ninguna cuenta origen por debajo de su
  // propio umbral.
  const sugerenciasTraspaso: SugerenciaTraspaso[] = [];
  const superavitRestante = superavitarias.map((s) => ({ ...s }));
  for (const d of deficitarias) {
    let pendiente = d.deficit;
    superavitRestante.sort((a, b) => b.superavit - a.superavit);
    for (const s of superavitRestante) {
      if (pendiente <= 0) break;
      if (s.superavit <= 0) continue;
      const mover = Math.min(pendiente, s.superavit);
      sugerenciasTraspaso.push({
        desdeEntidad: s.producto.entidad.nombre,
        desdeProducto: s.producto.nombre,
        haciaEntidad: d.producto.entidad.nombre,
        haciaProducto: d.producto.nombre,
        importe: mover,
      });
      s.superavit -= mover;
      pendiente -= mover;
    }
  }

  return { alertasSaldo, sugerenciasTraspaso };
}

export function calcularCentroAlertas(
  supuesto: SupuestoTesoreria | null,
  pagos: Pago[],
  cobros: Cobro[],
  productos: ProductoConEntidad[]
): CentroAlertas {
  const alertasInforme = supuesto
    ? calcularInforme(supuesto, pagos, cobros, productos).alertas.filter((a) => a.ok === false)
    : [];

  const { alertasSaldo, sugerenciasTraspaso } = calcularAlertasSaldo(productos);

  return {
    alertasInforme,
    alertasSaldo,
    sugerenciasTraspaso,
    total: alertasInforme.length + alertasSaldo.length,
  };
}

export async function obtenerCentroAlertas(): Promise<CentroAlertas> {
  const [supuesto, pagos, cobros, productos] = await Promise.all([
    prisma.supuestoTesoreria.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.pago.findMany(),
    prisma.cobro.findMany(),
    prisma.productoFinanciero.findMany({ include: { entidad: true } }),
  ]);

  return calcularCentroAlertas(supuesto, pagos, cobros, productos);
}
