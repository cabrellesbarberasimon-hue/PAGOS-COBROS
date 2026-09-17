import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { calcularInforme } from "@/lib/informe";
import { toNumber } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numOrDash(v: number | null): number | string {
  return v === null ? "—" : v;
}

export async function GET() {
  const [supuesto, pagos, cobros, productos] = await Promise.all([
    prisma.supuestoTesoreria.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.pago.findMany(),
    prisma.cobro.findMany(),
    prisma.productoFinanciero.findMany(),
  ]);

  if (!supuesto) {
    return NextResponse.json({ error: "No hay supuestos de proyección configurados." }, { status: 400 });
  }

  const informe = calcularInforme(supuesto, pagos, cobros, productos);
  const { embudo: e, riesgo: r, capacidadFinanciera: cf, kpis: k } = informe;

  const wb = XLSX.utils.book_new();

  const resumenRows = [
    ["Informe de posición — CUBI Mobiliario de Diseño SL"],
    [`Generado: ${informe.fechaGeneracion.toLocaleString("es-ES")}`],
    [],
    ["1. Embudo de conversión a caja"],
    ["Etapa", "Importe (€)"],
    ["Pedidos pendientes de servir", e.pedidosPendientesServir],
    ["Albaranes pendientes de facturar", e.albaranesPendientesFacturar],
    ["Facturas pendientes de cobro", e.facturasPendientesCobro],
    ["Efectos pendientes de remesar", e.efectosPendientesRemesar],
    ["Potencial pendiente de convertir", e.potencialPendienteConvertir],
    ["Liquidez ya en caja", e.liquidezYaEnCaja],
    ["TOTAL flujo potencial", e.totalFlujoPotencial],
    ["% ya convertido en caja", numOrDash(e.pctYaConvertido)],
    [],
    ["2. Calidad de liquidez"],
    ["Liquidez ajustada por riesgo (€)", informe.calidadLiquidez.liquidezAjustada],
    ["% ajustado sobre el total", numOrDash(informe.calidadLiquidez.pctAjustadoSobreTotal)],
    [],
    ["3. Riesgo de tesorería 30/60/90 días"],
    ["Horizonte", "Pagos pendientes (€)", "Cobertura caja", "Superávit/Déficit (€)"],
    ["30 días", r.pagos30, numOrDash(r.coberturaCaja30), r.superavitDeficit30],
    ["60 días", r.pagos60, "—", r.liquidezDisponible - r.pagos60],
    ["90 días", r.pagos90, numOrDash(r.coberturaCaja90), r.superavitDeficit90],
    ["Días de pago cubiertos con caja", r.diasPagoCubiertos ?? "—"],
    [],
    ["4. Capacidad financiera"],
    ["Cuota mensual deuda bancaria (€)", cf.cuotaMensualDeuda],
    ["Disponible inmediato (€)", cf.disponibleInmediato],
    ["Disponible no dispuesto en pólizas (€)", cf.disponibleNoDispuestoPolizas],
    ["Deuda bancaria corto plazo (€)", cf.deudaCPBancos],
    ["Deuda bancaria largo plazo (€)", cf.deudaLPBancos],
    [`Colchón de seguridad (${cf.colchonSeguridadMeses} meses) (€)`, cf.colchonSeguridadEuros],
    ["Meses de cuota cubiertos con disponible", cf.mesesCuotaCubiertos ?? "—"],
    ["Capacidad de inversión disponible (€)", cf.capacidadInversion],
    ["Capacidad de amortización anticipada (€)", cf.capacidadAmortizacionAnticipada],
    [],
    ["5. KPIs de gestión"],
    ["Conversión a caja", numOrDash(k.conversionACaja)],
    ["Facturación pendiente", numOrDash(k.facturacionPendientePct)],
    ["Cobro pendiente", numOrDash(k.cobroPendientePct)],
    ["Cobertura de deuda total", numOrDash(k.coberturaDeudaTotalPct)],
    ["Cobertura deuda corto plazo (×)", k.coberturaDeudaCPBancaPct ?? "—"],
    ["Cobertura de pagos a 90 días", numOrDash(k.coberturaPagos90Pct)],
    ["Peso cuota mensual sobre disponible", numOrDash(k.pesoCuotaSobreDisponiblePct)],
    ["Apalancamiento (×)", k.apalancamiento ?? "—"],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  wsResumen["!cols"] = [{ wch: 42 }, { wch: 20 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, "Informe");

  const alertasRows = [
    ["Alerta", "Valor", "Umbral", "Estado", "Detalle"],
    ...informe.alertas.map((a) => [
      a.label,
      a.formato === "pct" ? a.valor : a.valor,
      a.umbral,
      a.ok === null ? "Sin datos" : a.ok ? "OK" : "Revisar",
      a.detalle,
    ]),
  ];
  const wsAlertas = XLSX.utils.aoa_to_sheet(alertasRows);
  wsAlertas["!cols"] = [{ wch: 42 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsAlertas, "Alertas");

  const proyeccionRows = [
    ["Mes", "Cobros (€)", "Pagos (€)", "Origen pagos", "Flujo neto (€)", "Saldo sin póliza (€)", "Saldo con pólizas (€)", "Saldo + línea CaixaBank (€)"],
    ...informe.proyeccion12Meses.map((m) => [
      m.fecha.toLocaleDateString("es-ES", { month: "short", year: "numeric" }),
      toNumber(m.cobros),
      toNumber(m.pagos),
      m.origenPagos === "real" ? "Datos reales" : "Estimado",
      toNumber(m.flujoNeto),
      toNumber(m.saldoSinPoliza),
      toNumber(m.saldoConPolizas),
      toNumber(m.saldoConLineaCaixabank),
    ]),
  ];
  const wsProyeccion = XLSX.utils.aoa_to_sheet(proyeccionRows);
  wsProyeccion["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsProyeccion, "Proyección 12 meses");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const fecha = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="informe-posicion-${fecha}.xlsx"`,
    },
  });
}
