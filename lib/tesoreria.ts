import { Partida, type Pago, type ProductoFinanciero, type SupuestoTesoreria } from "@prisma/client";
import { toNumber } from "./format";
import { cuotaEnMes, generarCuadroAmortizacion, type FilaAmortizacion } from "./amortizacion";

export interface MesProyeccion {
  fecha: Date;
  cobros: number;
  pagos: number;
  flujoNeto: number;
  saldoSinPoliza: number;
  saldoConPolizas: number;
  saldoConLineaCaixabank: number;
  origenPagos: "real" | "estimado";
}

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function addMonthsUTC(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
}

const MESES_TRIMESTRE = [0, 3, 6, 9]; // enero, abril, julio, octubre (getUTCMonth 0-indexado)

export interface ProductoConCuadro {
  producto: ProductoFinanciero;
  cuadro: FilaAmortizacion[];
}

// Genera el cuadro de amortización "en vivo" de un producto financiero a
// partir de sus parámetros, o usa el cuadro persistido si lo tiene.
export function cuadroDeProducto(producto: ProductoFinanciero): FilaAmortizacion[] {
  if (producto.cuadroPersonalizado) {
    // Ya viene resuelto como FilaAmortizacion[] serializable desde donde se cree.
    return (producto.cuadroPersonalizado as unknown as FilaAmortizacion[]).map((f) => ({
      ...f,
      fecha: new Date(f.fecha),
    }));
  }

  if (!producto.cuotaMensual || !producto.fechaPrimerVencimiento) return [];

  return generarCuadroAmortizacion({
    saldoPendiente: toNumber(producto.pendienteManual ?? producto.capitalInicial ?? 0),
    cuotaMensual: toNumber(producto.cuotaMensual),
    tipoInteresAnual: toNumber(producto.tipoInteresAnual ?? 0),
    fechaProximoVencimiento: producto.fechaPrimerVencimiento,
    numCuotasRestantes: producto.numCuotas ?? undefined,
  });
}

/**
 * Calcula la proyección de tesorería mes a mes.
 *
 * A diferencia del Excel original (que fijaba "a mano" hasta qué mes usar
 * datos reales de PAGOS), aquí la regla es dinámica: si para un mes concreto
 * ya hay pagos reales registrados en la app, se usa su suma; si no, se usa
 * la estimación (gastos fijos + proveedores + cuotas de deuda calculadas +
 * seguro nave prorrateado + Mod 111 trimestral + previsión). Así la
 * proyección se vuelve más precisa según se van registrando pagos reales,
 * sin necesidad de tocar ningún supuesto a mano.
 */
export function calcularProyeccion(
  supuesto: SupuestoTesoreria,
  pagos: Pago[],
  productosFinancieros: ProductoFinanciero[]
): MesProyeccion[] {
  const cuadros = productosFinancieros
    .filter((p) => p.tipo === "PRESTAMO" || p.tipo === "LEASING")
    .map((producto) => ({ producto, cuadro: cuadroDeProducto(producto) }));

  const inicio = startOfMonthUTC(new Date(supuesto.fechaInicioProyeccion));
  const meses: MesProyeccion[] = [];

  let saldoSinPoliza = toNumber(supuesto.saldoInicialCuentas);
  let saldoConPolizas = toNumber(supuesto.saldoInicialCuentasPolizas);
  const lineaCaixabank = toNumber(supuesto.lineaFinanciacionCaixabank);

  const facturacionMensual = toNumber(supuesto.facturacionMensual);
  const letrasEnCartera = toNumber(supuesto.letrasEnCartera);
  const pctLetras = toNumber(supuesto.pctLetrasCobradasPrimerMes);
  const albaranes = toNumber(supuesto.albaranesGirosACobrar);

  const pagosProveedoresMes = toNumber(supuesto.pagosProveedoresMes);
  const gastosFijosMes = toNumber(supuesto.gastosFijosMes);
  const seguroNaveMes = toNumber(supuesto.seguroNavePrimaAnual) / 12;
  const mod111Trimestre = toNumber(supuesto.pagoMod111Trimestre);
  const previsionMensual = toNumber(supuesto.previsionMensual);

  for (let i = 0; i < supuesto.mesesProyeccion; i++) {
    const mesInicio = addMonthsUTC(inicio, i);
    const mesFin = endOfMonthUTC(mesInicio);

    // --- Cobros ---
    let cobros = facturacionMensual;
    if (i === 0) cobros += letrasEnCartera * pctLetras + albaranes;
    if (i === 1) cobros += letrasEnCartera * (1 - pctLetras);

    // --- Pagos: reales si existen para el mes, si no estimados ---
    const pagosReales = pagos
      .filter((p) => p.fechaPago >= mesInicio && p.fechaPago <= mesFin)
      .reduce((sum, p) => sum + toNumber(p.importe), 0);

    const cuotaDeuda = cuadros.reduce((sum, { cuadro }) => sum + cuotaEnMes(cuadro, mesInicio, mesFin), 0);
    const esMesTrimestre = MESES_TRIMESTRE.includes(mesInicio.getUTCMonth());
    const pagosEstimados =
      pagosProveedoresMes +
      gastosFijosMes +
      seguroNaveMes +
      (esMesTrimestre ? mod111Trimestre : 0) +
      previsionMensual +
      cuotaDeuda;

    const pagos_ = pagosReales > 0 ? pagosReales : pagosEstimados;
    const origenPagos: "real" | "estimado" = pagosReales > 0 ? "real" : "estimado";

    const flujoNeto = cobros - pagos_;

    saldoSinPoliza += flujoNeto;
    saldoConPolizas += flujoNeto;

    meses.push({
      fecha: mesInicio,
      cobros,
      pagos: pagos_,
      flujoNeto,
      saldoSinPoliza,
      saldoConPolizas,
      saldoConLineaCaixabank: saldoConPolizas + lineaCaixabank,
      origenPagos,
    });
  }

  return meses;
}

export function resumenPorPartida(pagos: Pago[]) {
  const grupos = new Map<Partida, { nCount: number; total: number }>();
  for (const p of pagos) {
    const actual = grupos.get(p.partida) ?? { nCount: 0, total: 0 };
    actual.nCount += 1;
    actual.total += toNumber(p.importe);
    grupos.set(p.partida, actual);
  }
  return Array.from(grupos.entries())
    .map(([partida, v]) => ({ partida, ...v }))
    .sort((a, b) => b.total - a.total);
}

export function resumenPorProveedor(pagos: Pago[]) {
  const grupos = new Map<string, { nCount: number; total: number }>();
  for (const p of pagos) {
    const key = p.proveedor?.trim() || "(sin proveedor identificado)";
    const actual = grupos.get(key) ?? { nCount: 0, total: 0 };
    actual.nCount += 1;
    actual.total += toNumber(p.importe);
    grupos.set(key, actual);
  }
  return Array.from(grupos.entries())
    .map(([proveedor, v]) => ({ proveedor, ...v }))
    .sort((a, b) => b.total - a.total);
}

// Saldo pendiente "actual" de un producto financiero: el valor manual
// importado/editado si existe, o si no el saldo inicial de su cuadro de
// amortización en vivo (primera fila = balance justo antes de la próxima cuota).
export function pendienteActual(producto: ProductoFinanciero): number {
  if (producto.pendienteManual !== null && producto.pendienteManual !== undefined) {
    return toNumber(producto.pendienteManual);
  }
  const cuadro = cuadroDeProducto(producto);
  return cuadro[0]?.saldoInicial ?? 0;
}

// Detecta posibles duplicados: misma observación + misma fecha de pago.
// Sustituye a la hoja "Verificación" del Excel.
export function detectarDuplicados(pagos: Pago[]): Pago[][] {
  const grupos = new Map<string, Pago[]>();
  for (const p of pagos) {
    const key = `${p.observacion.trim().toLowerCase()}|${p.fechaPago.toISOString().slice(0, 10)}`;
    const arr = grupos.get(key) ?? [];
    arr.push(p);
    grupos.set(key, arr);
  }
  return Array.from(grupos.values()).filter((arr) => arr.length > 1);
}
