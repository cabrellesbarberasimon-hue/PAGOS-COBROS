import type { Cobro, Pago, ProductoFinanciero, SupuestoTesoreria } from "@prisma/client";
import { toNumber } from "./format";
import { calcularProyeccion, type MesProyeccion } from "./tesoreria";
import { computeDashboardKpis } from "./kpis";

// Motor del "Informe de posición" (antes la 2ª capa de análisis de la hoja
// Situación Bancaria del Excel: embudo de conversión a caja, calidad de
// liquidez, riesgo 30/60/90 días, capacidad financiera, KPIs de gestión y
// alertas automáticas). Es un informe *puntual*, calculado siempre con los
// datos de hoy — no se persiste nada salvo los 3 insumos manuales que no se
// pueden derivar de Pagos/Cobros (pedidos pendientes de servir, inversiones
// pendientes y el colchón de seguridad en meses de cuota).
//
// El escenario de proyección a 12 meses que traía el Excel en esta misma
// hoja, en paralelo a la hoja "Proyección Tesorería", no se reimplementa
// aparte: aquí simplemente se reutilizan los primeros 12 meses del mismo
// motor de proyección (lib/tesoreria.ts) para no mantener dos lógicas.

const DIA_MS = 24 * 60 * 60 * 1000;

// Cobrabilidad estimada por categoría de la cartera comercial pendiente de
// convertir en caja. Son supuestos razonables (no vienen de ningún dato del
// sistema), documentados aquí para poder ajustarlos si hace falta.
const COBRABILIDAD = {
  efectosPendientesRemesar: 0.95,
  facturasPendientesCobro: 0.9,
  albaranesPendientesFacturar: 0.8,
  pedidosPendientesServir: 0.65,
};

// Umbrales del panel de alertas automáticas.
const UMBRALES = {
  coberturaCaja30d: 1,
  coberturaPagos90d: 1,
  coberturaDeudaTotal: 1,
  apalancamientoMax: 3,
  conversionACajaMin: 0.3,
  pesoCuotaMax: 0.1,
};

function hoy(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function pagosPendientesEnDias(pagos: Pago[], dias: number): number {
  const h = hoy();
  const limite = new Date(h.getTime() + dias * DIA_MS);
  return pagos
    .filter((p) => p.estado === "PENDIENTE" && p.fechaPago >= h && p.fechaPago <= limite)
    .reduce((s, p) => s + toNumber(p.importe), 0);
}

function sumaPagosPendientesPorPartida(pagos: Pago[], partida: string): number {
  return pagos
    .filter((p) => p.estado === "PENDIENTE" && p.partida === partida)
    .reduce((s, p) => s + toNumber(p.importe), 0);
}

export interface AlertaInforme {
  label: string;
  valor: number | null;
  umbral: number;
  formato: "moneda" | "pct" | "ratio";
  ok: boolean | null;
  detalle: string;
}

export interface InformePosicion {
  fechaGeneracion: Date;

  embudo: {
    pedidosPendientesServir: number;
    albaranesPendientesFacturar: number;
    facturasPendientesCobro: number;
    efectosPendientesRemesar: number;
    potencialPendienteConvertir: number;
    liquidezYaEnCaja: number;
    totalFlujoPotencial: number;
    pctYaConvertido: number | null;
  };

  calidadLiquidez: {
    liquidezAjustada: number;
    pctAjustadoSobreTotal: number | null;
  };

  riesgo: {
    liquidezDisponible: number;
    pagos30: number;
    pagos60: number;
    pagos90: number;
    coberturaCaja30: number | null;
    coberturaCajaEfectos30: number | null;
    coberturaCaja90: number | null;
    superavitDeficit30: number;
    superavitDeficit90: number;
    diasPagoCubiertos: number | null;
  };

  capacidadFinanciera: {
    cuotaMensualDeuda: number;
    disponibleInmediato: number;
    disponibleNoDispuestoPolizas: number;
    deudaCPBancos: number;
    deudaLPBancos: number;
    inversionesPendientes: number;
    colchonSeguridadMeses: number;
    colchonSeguridadEuros: number;
    efectivoNetoOperativo: number;
    capacidadInversion: number;
    capacidadAmortizacionAnticipada: number;
    mesesCuotaCubiertos: number | null;
  };

  kpis: {
    conversionACaja: number | null;
    facturacionPendientePct: number | null;
    cobroPendientePct: number | null;
    coberturaDeudaTotalPct: number | null;
    coberturaDeudaCPBancaPct: number | null;
    coberturaPagos90Pct: number | null;
    pesoCuotaSobreDisponiblePct: number | null;
    apalancamiento: number | null;
  };

  alertas: AlertaInforme[];

  proyeccion12Meses: MesProyeccion[];
}

export function calcularInforme(
  supuesto: SupuestoTesoreria,
  pagos: Pago[],
  cobros: Cobro[],
  productos: ProductoFinanciero[]
): InformePosicion {
  const cobrosNormales = cobros.filter((c) => c.tipo === "NORMAL");
  const kpisDashboard = computeDashboardKpis(productos, pagos, cobrosNormales);

  // --- 1. Embudo de conversión a caja ---
  const pedidosPendientesServir = toNumber(supuesto.pedidosPendientesServir);
  const albaranesPendientesFacturar = toNumber(supuesto.albaranesGirosACobrar);
  const facturasPendientesCobro = cobrosNormales.reduce(
    (s, c) => s + toNumber(c.importeTalon) + toNumber(c.importeTransferencia),
    0
  );
  const efectosPendientesRemesar = toNumber(supuesto.letrasEnCartera);
  const potencialPendienteConvertir =
    pedidosPendientesServir + albaranesPendientesFacturar + facturasPendientesCobro + efectosPendientesRemesar;
  const liquidezYaEnCaja = kpisDashboard.liquidezDisponible;
  const totalFlujoPotencial = potencialPendienteConvertir + liquidezYaEnCaja;

  const embudo = {
    pedidosPendientesServir,
    albaranesPendientesFacturar,
    facturasPendientesCobro,
    efectosPendientesRemesar,
    potencialPendienteConvertir,
    liquidezYaEnCaja,
    totalFlujoPotencial,
    pctYaConvertido: totalFlujoPotencial > 0 ? liquidezYaEnCaja / totalFlujoPotencial : null,
  };

  // --- 2. Calidad de liquidez (cartera comercial ponderada por cobrabilidad) ---
  const liquidezAjustada =
    efectosPendientesRemesar * COBRABILIDAD.efectosPendientesRemesar +
    facturasPendientesCobro * COBRABILIDAD.facturasPendientesCobro +
    albaranesPendientesFacturar * COBRABILIDAD.albaranesPendientesFacturar +
    pedidosPendientesServir * COBRABILIDAD.pedidosPendientesServir +
    liquidezYaEnCaja;

  const calidadLiquidez = {
    liquidezAjustada,
    pctAjustadoSobreTotal: totalFlujoPotencial > 0 ? liquidezAjustada / totalFlujoPotencial : null,
  };

  // --- 3. Riesgo de tesorería 30/60/90 días (a partir de Pagos reales) ---
  const pagos30 = pagosPendientesEnDias(pagos, 30);
  const pagos60 = pagosPendientesEnDias(pagos, 60);
  const pagos90 = pagosPendientesEnDias(pagos, 90);
  const liquidezDisponible = kpisDashboard.liquidezDisponible;

  const riesgo = {
    liquidezDisponible,
    pagos30,
    pagos60,
    pagos90,
    coberturaCaja30: pagos30 > 0 ? liquidezDisponible / pagos30 : null,
    coberturaCajaEfectos30: pagos30 > 0 ? (liquidezDisponible + efectosPendientesRemesar) / pagos30 : null,
    coberturaCaja90: pagos90 > 0 ? liquidezDisponible / pagos90 : null,
    superavitDeficit30: liquidezDisponible - pagos30,
    superavitDeficit90: liquidezDisponible - pagos90,
    diasPagoCubiertos: pagos90 > 0 ? liquidezDisponible / (pagos90 / 90) : null,
  };

  // --- 4. Capacidad financiera ---
  const cuotaMensualDeuda = productos.reduce((s, p) => s + toNumber(p.cuotaMensual), 0);
  const deudaCPBancos = sumaPagosPendientesPorPartida(pagos, "BANCOS");
  const deudaLPBancos = Math.max(0, kpisDashboard.deudaTotalBancos - deudaCPBancos);
  const inversionesPendientes = toNumber(supuesto.inversionesPendientes);
  const colchonSeguridadMeses = toNumber(supuesto.colchonSeguridadMeses);
  const colchonSeguridadEuros = colchonSeguridadMeses * cuotaMensualDeuda;
  const pagosPendientesProveedores = sumaPagosPendientesPorPartida(pagos, "PROVEEDORES");
  const efectivoNetoOperativo = totalFlujoPotencial - pagosPendientesProveedores - inversionesPendientes;

  const capacidadFinanciera = {
    cuotaMensualDeuda,
    disponibleInmediato: liquidezDisponible,
    disponibleNoDispuestoPolizas: kpisDashboard.disponibleEnPolizas,
    deudaCPBancos,
    deudaLPBancos,
    inversionesPendientes,
    colchonSeguridadMeses,
    colchonSeguridadEuros,
    efectivoNetoOperativo,
    capacidadInversion: efectivoNetoOperativo - colchonSeguridadEuros,
    capacidadAmortizacionAnticipada: Math.max(0, liquidezDisponible - colchonSeguridadEuros),
    mesesCuotaCubiertos: cuotaMensualDeuda > 0 ? liquidezDisponible / cuotaMensualDeuda : null,
  };

  // --- 5. KPIs de gestión ---
  const deudaTotalRestante = deudaCPBancos + deudaLPBancos;
  const kpis = {
    conversionACaja: embudo.pctYaConvertido,
    facturacionPendientePct:
      efectosPendientesRemesar + facturasPendientesCobro + albaranesPendientesFacturar > 0
        ? albaranesPendientesFacturar / (efectosPendientesRemesar + facturasPendientesCobro + albaranesPendientesFacturar)
        : null,
    cobroPendientePct:
      efectosPendientesRemesar + facturasPendientesCobro > 0
        ? facturasPendientesCobro / (efectosPendientesRemesar + facturasPendientesCobro)
        : null,
    coberturaDeudaTotalPct: deudaTotalRestante > 0 ? liquidezAjustada / deudaTotalRestante : null,
    coberturaDeudaCPBancaPct: deudaCPBancos > 0 ? liquidezDisponible / deudaCPBancos : null,
    coberturaPagos90Pct: riesgo.coberturaCaja90,
    pesoCuotaSobreDisponiblePct: liquidezDisponible > 0 ? cuotaMensualDeuda / liquidezDisponible : null,
    apalancamiento: liquidezDisponible > 0 ? deudaTotalRestante / liquidezDisponible : null,
  };

  // --- 6. Panel de alertas automáticas ---
  const alertas: AlertaInforme[] = [
    {
      label: "Cobertura de pagos a 30 días (solo caja)",
      valor: riesgo.coberturaCaja30,
      umbral: UMBRALES.coberturaCaja30d,
      formato: "ratio",
      ok: riesgo.coberturaCaja30 === null ? null : riesgo.coberturaCaja30 >= UMBRALES.coberturaCaja30d,
      detalle: "Liquidez disponible frente a los pagos pendientes en los próximos 30 días.",
    },
    {
      label: "Cobertura de pagos a 90 días (solo caja)",
      valor: kpis.coberturaPagos90Pct,
      umbral: UMBRALES.coberturaPagos90d,
      formato: "ratio",
      ok: kpis.coberturaPagos90Pct === null ? null : kpis.coberturaPagos90Pct >= UMBRALES.coberturaPagos90d,
      detalle: "Liquidez disponible frente a los pagos pendientes en los próximos 90 días.",
    },
    {
      label: "La cartera cubre la deuda total",
      valor: kpis.coberturaDeudaTotalPct,
      umbral: UMBRALES.coberturaDeudaTotal,
      formato: "ratio",
      ok: kpis.coberturaDeudaTotalPct === null ? null : kpis.coberturaDeudaTotalPct >= UMBRALES.coberturaDeudaTotal,
      detalle: "Liquidez ajustada por riesgo frente a la deuda bancaria pendiente.",
    },
    {
      label: "Apalancamiento máximo",
      valor: kpis.apalancamiento,
      umbral: UMBRALES.apalancamientoMax,
      formato: "ratio",
      ok: kpis.apalancamiento === null ? null : kpis.apalancamiento <= UMBRALES.apalancamientoMax,
      detalle: "Deuda bancaria pendiente entre liquidez disponible.",
    },
    {
      label: "Conversión mínima a caja",
      valor: kpis.conversionACaja,
      umbral: UMBRALES.conversionACajaMin,
      formato: "pct",
      ok: kpis.conversionACaja === null ? null : kpis.conversionACaja >= UMBRALES.conversionACajaMin,
      detalle: "% del flujo potencial (pipeline + caja) que ya está en caja.",
    },
    {
      label: "Peso de la cuota mensual sobre el disponible",
      valor: kpis.pesoCuotaSobreDisponiblePct,
      umbral: UMBRALES.pesoCuotaMax,
      formato: "pct",
      ok:
        kpis.pesoCuotaSobreDisponiblePct === null
          ? null
          : kpis.pesoCuotaSobreDisponiblePct <= UMBRALES.pesoCuotaMax,
      detalle: "Cuota mensual de deuda bancaria entre liquidez disponible inmediata.",
    },
  ];

  // --- 7. Proyección a 12 meses (reutiliza el motor de Proyección) ---
  const proyeccionCompleta = calcularProyeccion(supuesto, pagos, productos);
  const proyeccion12Meses = proyeccionCompleta.slice(0, 12);

  return {
    fechaGeneracion: new Date(),
    embudo,
    calidadLiquidez,
    riesgo,
    capacidadFinanciera,
    kpis,
    alertas,
    proyeccion12Meses,
  };
}
