// Motor de amortización de préstamos/leasing (sistema francés: cuota
// constante, intereses sobre saldo vivo). Se calcula siempre en vivo a
// partir de los parámetros guardados en ProductoFinanciero — no se persiste
// fila a fila, salvo que el producto tenga un `cuadroPersonalizado` (p.ej.
// carencia de capital al principio, o cuotas que no siguen la fórmula
// estándar, como se observó en el Excel original para varios préstamos).

export interface FilaAmortizacion {
  numero: number;
  fecha: Date;
  saldoInicial: number;
  intereses: number;
  capital: number;
  cuota: number;
  saldoFinal: number;
}

export interface ParametrosAmortizacion {
  saldoPendiente: number; // saldo vivo a día de hoy (o a la fecha de arranque del cuadro)
  cuotaMensual: number;
  tipoInteresAnual: number; // en tanto por uno, p.ej. 0.02 = 2%
  fechaProximoVencimiento: Date;
  numCuotasRestantes?: number | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

const MAX_CUOTAS_SEGURIDAD = 600; // 50 años, límite de seguridad ante datos erróneos

export function generarCuadroAmortizacion(params: ParametrosAmortizacion): FilaAmortizacion[] {
  const tipoMensual = (params.tipoInteresAnual ?? 0) / 12;
  const filas: FilaAmortizacion[] = [];

  let saldo = params.saldoPendiente;
  let fecha = params.fechaProximoVencimiento;
  let numero = 1;
  const tope = params.numCuotasRestantes ?? MAX_CUOTAS_SEGURIDAD;

  while (saldo > 0.5 && numero <= tope) {
    const saldoInicial = saldo;
    const intereses = round2(saldoInicial * tipoMensual);
    let capital = round2(params.cuotaMensual - intereses);
    let cuota = params.cuotaMensual;

    // Última cuota: ajusta para no dejar saldo residual por redondeos.
    if (capital >= saldoInicial) {
      capital = saldoInicial;
      cuota = round2(capital + intereses);
    }

    const saldoFinal = round2(saldoInicial - capital);

    filas.push({ numero, fecha: new Date(fecha), saldoInicial, intereses, capital, cuota, saldoFinal });

    saldo = saldoFinal;
    fecha = addMonths(fecha, 1);
    numero += 1;
  }

  return filas;
}

export interface FilaAmortizacionPersonalizada {
  numero: number;
  fecha: string; // ISO
  capital: number;
  intereses?: number;
}

// Cuando el producto trae un cuadro no estándar (carencia, tramos de tipo
// variable ya conocidos, etc.) reconstruimos las filas completas a partir de
// los importes de capital indicados, calculando el resto por diferencia.
export function aplicarCuadroPersonalizado(
  saldoInicial: number,
  cuotaMensual: number,
  filas: FilaAmortizacionPersonalizada[]
): FilaAmortizacion[] {
  let saldo = saldoInicial;
  return filas.map((f) => {
    const capital = f.capital;
    const intereses = f.intereses ?? round2(cuotaMensual - capital);
    const saldoInicialFila = saldo;
    const saldoFinal = round2(saldo - capital);
    saldo = saldoFinal;
    return {
      numero: f.numero,
      fecha: new Date(f.fecha),
      saldoInicial: saldoInicialFila,
      intereses,
      capital,
      cuota: round2(capital + intereses),
      saldoFinal,
    };
  });
}

// Cuota francesa estándar, útil como sugerencia al dar de alta un préstamo
// nuevo sin cuota todavía conocida.
export function calcularCuotaFrancesa(capital: number, tipoInteresAnual: number, numCuotas: number): number {
  const i = tipoInteresAnual / 12;
  if (i === 0) return round2(capital / numCuotas);
  const cuota = (capital * i) / (1 - Math.pow(1 + i, -numCuotas));
  return round2(cuota);
}

// Saldo pendiente estimado en una fecha dada (equivalente al LOOKUP que usaba
// el Excel contra el cuadro de amortización).
export function saldoPendienteEn(cuadro: FilaAmortizacion[], fecha: Date, saldoSiAntes: number): number {
  if (cuadro.length === 0) return saldoSiAntes;
  if (fecha < cuadro[0].fecha) return saldoSiAntes;

  let ultimo = saldoSiAntes;
  for (const fila of cuadro) {
    if (fila.fecha > fecha) break;
    ultimo = fila.saldoFinal;
  }
  return ultimo;
}

// Cuota que corresponde pagar por este producto en un mes dado (0 si el
// préstamo ya está amortizado por completo o el mes es anterior al inicio).
export function cuotaEnMes(cuadro: FilaAmortizacion[], primerDiaMes: Date, ultimoDiaMes: Date): number {
  return cuadro
    .filter((f) => f.fecha >= primerDiaMes && f.fecha <= ultimoDiaMes)
    .reduce((sum, f) => sum + f.cuota, 0);
}
