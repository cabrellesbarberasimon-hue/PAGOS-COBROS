import type { Cobro, Pago, ProductoFinanciero } from "@prisma/client";
import { toNumber } from "./format";
import { pendienteActual } from "./tesoreria";
import { estadoColorCobro } from "./cobro-color";

const DIA_MS = 24 * 60 * 60 * 1000;

export interface DashboardKpis {
  liquidezDisponible: number;
  deudaTotalBancos: number;
  disponibleEnPolizas: number;
  vencimientos7: number;
  vencimientos15: number;
  vencimientos30: number;
  cobrosVencidos: number;
  cobrosVencidosCount: number;
}

export function computeDashboardKpis(
  productos: ProductoFinanciero[],
  pagos: Pago[],
  cobros: Cobro[]
): DashboardKpis {
  const liquidezDisponible = productos
    .filter((p) => p.tipo === "CUENTA" || p.tipo === "POLIZA_CREDITO" || p.tipo === "LINEA_DESCUENTO")
    .reduce((sum, p) => sum + toNumber(p.disponible), 0);

  const disponibleEnPolizas = productos
    .filter((p) => p.tipo === "POLIZA_CREDITO" || p.tipo === "LINEA_DESCUENTO")
    .reduce((sum, p) => sum + toNumber(p.disponible), 0);

  const deudaTotalBancos = productos
    .filter((p) => p.tipo === "PRESTAMO" || p.tipo === "LEASING")
    .reduce((sum, p) => sum + pendienteActual(p), 0);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const pendientes = pagos.filter((p) => p.estado === "PENDIENTE");
  const importeVencimientosHasta = (dias: number) => {
    const limite = new Date(hoy.getTime() + dias * DIA_MS);
    return pendientes
      .filter((p) => p.fechaPago >= hoy && p.fechaPago <= limite)
      .reduce((sum, p) => sum + toNumber(p.importe), 0);
  };

  const cobrosVencidos = cobros.filter((c) => estadoColorCobro(c.fechaVencimiento) === "VENCIDO");
  const cobrosVencidosTotal = cobrosVencidos.reduce(
    (sum, c) => sum + toNumber(c.importeTalon) + toNumber(c.importeTransferencia),
    0
  );

  return {
    liquidezDisponible,
    deudaTotalBancos,
    disponibleEnPolizas,
    vencimientos7: importeVencimientosHasta(7),
    vencimientos15: importeVencimientosHasta(15),
    vencimientos30: importeVencimientosHasta(30),
    cobrosVencidos: cobrosVencidosTotal,
    cobrosVencidosCount: cobrosVencidos.length,
  };
}
