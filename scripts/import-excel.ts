/**
 * Importación inicial del histórico desde el Excel
 * "PAGOS-COBROS_PROYECCIONES_18-09.xlsx" a la base de datos.
 *
 * Uso:
 *   npm run import:excel -- /ruta/al/excel.xlsx
 *   npm run import:excel -- /ruta/al/excel.xlsx --dry-run   (solo muestra el resumen, no escribe nada)
 *   npm run import:excel -- /ruta/al/excel.xlsx --force     (ignora el aviso de "ya importado antes")
 *
 * Pensado para ejecutarse UNA VEZ, con el Excel histórico. A partir de ahí la
 * app es la fuente de verdad: los pagos/cobros nuevos se dan de alta desde la
 * propia aplicación (formulario o subida de Excel/CSV parcial), no
 * reimportando este script con el fichero completo.
 *
 * Las posiciones de fila/columna de cada hoja se verificaron manualmente
 * contra el fichero real (no se asumen números de fila fijos "de memoria"):
 *  - PAGOS: cabecera en fila 4 (cols B:G) para la tabla de pagos programados,
 *    y cabecera en fila 1 (cols X:AB) para la tabla histórica de pagos ya
 *    ejecutados ("lista maestra" a la que se refiere la hoja Verificación).
 *  - COBROS: cabecera en fila 2 (normales) y fila 12 (incidencias/devoluciones).
 *  - "+": secciones delimitadas por texto de cabecera en columna B, sin fila fija.
 *  - Pool Bancario: cabecera en fila 5, datos filas 6-19.
 *  - Situación Bancaria: préstamos especiales (IVF, AEAT) en filas 22-23.
 *  - Amortizaciones: parámetros de cada préstamo en filas 4-11, en 5 bloques
 *    de columnas (A, I, Q, Y, AG) — ver PRODUCTO_BLOQUES más abajo.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient, CategoriaCobroEspecial, TipoProducto, type Prisma } from "@prisma/client";
import {
  cell,
  cellDate,
  cellNumber,
  cellText,
  lastRow,
  parsePagosSheetCompleto,
  parseCobrosSheetCompleto,
  type PagoImportado,
  type CobroImportado,
} from "../lib/excel-import";

const prisma = new PrismaClient();

// Los parsers de PAGOS y COBROS en formato completo (el Excel original) viven
// en lib/excel-import.ts porque también los usa la pantalla web "Importar
// Excel" para las altas puntuales. Aquí solo añadimos lo específico de la
// carga inicial: Cobros especiales, Bancos, Supuestos y el propio orquestador.
function parsePagos(wb: XLSX.WorkBook, warnings: string[]): PagoImportado[] {
  return parsePagosSheetCompleto(wb, warnings);
}

function parseCobros(wb: XLSX.WorkBook): CobroImportado[] {
  return parseCobrosSheetCompleto(wb);
}

// ---------------------------------------------------------------------------
// COBROS ESPECIALES (hoja "+")
// ---------------------------------------------------------------------------

interface CobroEspecialImportado {
  categoria: CategoriaCobroEspecial;
  clienteFactura: string;
  importe: number;
  observaciones: string | null;
}

const SECCIONES_COBRO_ESPECIAL: Array<{ marker: string; categoria: CategoriaCobroEspecial }> = [
  { marker: "TRF PENDIENTES INSIGNIFICATIVAS", categoria: "INSIGNIFICANTE_INACTIVO" },
  { marker: "TRFS PENDIENTES DE DUDOSO COBRO", categoria: "DUDOSO_COBRO" },
  { marker: "TRFS PENDIENTES DE CLIENTES ACTIVOS", categoria: "ACTIVO_PENDIENTE" },
  { marker: "FALTA POR HACER ABONO", categoria: "FALTA_ABONO" },
  { marker: "ABONOS FALTAN POR PAGAR", categoria: "ABONO_PENDIENTE" },
  { marker: "PENDIENTE REVISAR", categoria: "PENDIENTE_REVISAR" },
];

function parseCobrosEspeciales(wb: XLSX.WorkBook, warnings: string[]): CobroEspecialImportado[] {
  const sheet = wb.Sheets["+"];
  if (!sheet) throw new Error('No se encontró la hoja "+"');

  const resultado: CobroEspecialImportado[] = [];
  const maxRow = lastRow(sheet);
  let categoriaActual: CategoriaCobroEspecial | null = null;

  for (let r = 1; r <= maxRow; r++) {
    const bRaw = cell(sheet, r, 2); // B
    const bText = typeof bRaw === "string" ? bRaw.trim() : null;

    if (bText) {
      const seccion = SECCIONES_COBRO_ESPECIAL.find((s) => bText.toUpperCase().includes(s.marker));
      if (seccion) {
        categoriaActual = seccion.categoria;
        continue;
      }
      if (bText.toUpperCase().startsWith("SUBTOTAL") || bText.toUpperCase().startsWith("TOTAL")) {
        categoriaActual = null;
        continue;
      }
    }

    if (!categoriaActual) continue;

    const importe = cellNumber(sheet, r, 3); // C
    if (!bText || importe === null) continue;

    resultado.push({
      categoria: categoriaActual,
      clienteFactura: bText,
      importe,
      observaciones: cellText(sheet, r, 4), // D
    });
  }

  if (resultado.length === 0) {
    warnings.push('Hoja "+": no se encontraron filas de cobros especiales clasificables.');
  }

  return resultado;
}

// ---------------------------------------------------------------------------
// BANCOS: EntidadFinanciera + ProductoFinanciero
// ---------------------------------------------------------------------------

interface ProductoImportado {
  entidad: string;
  tipo: TipoProducto;
  nombre: string;
  capitalInicial: number | null;
  pendienteManual: number | null;
  dispuesto: number | null;
  disponible: number | null;
  tipoInteresTexto: string | null;
  tipoInteresAnual: number | null;
  cuotaMensual: number | null;
  fechaConstitucion: Date | null;
  fechaPrimerVencimiento: Date | null;
  fechaVencimiento: Date | null;
  numCuotas: number | null;
  observaciones: string | null;
}

function inferirTipoProducto(nombre: string): TipoProducto {
  const u = nombre.toUpperCase();
  if (u.includes("LEASING")) return "LEASING";
  if (u.includes("POLIZA") || u.includes("PÓLIZA")) return "POLIZA_CREDITO";
  if (u.includes("DESCUENTO")) return "LINEA_DESCUENTO";
  if (u.includes("CUENTA")) return "CUENTA";
  return "PRESTAMO";
}

function parseTipoInteresAnual(texto: string | null): number | null {
  if (!texto) return null;
  const match = texto.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!match) return null;
  return parseFloat(match[1].replace(",", ".")) / 100;
}

// Parámetros verificados manualmente en la hoja Amortizaciones (filas 4-11),
// uno por cada bloque de columnas. numCuotas se deja null: el motor de
// amortización de la app se detiene solo al llegar a saldo 0.
const AMORTIZACION_PARAMS: Record<string, { tipoInteresAnual: number; fechaPrimerVencimientoFutura: string }> = {
  "BANCO  SABADELL::PRESTAMO  COVID  ICO": { tipoInteresAnual: 0.02, fechaPrimerVencimientoFutura: "" },
  "LA CAIXA::Ico-créditos": { tipoInteresAnual: 0.045000778649017664, fechaPrimerVencimientoFutura: "" },
  "LA CAIXA::ICO DANA": { tipoInteresAnual: 0, fechaPrimerVencimientoFutura: "" },
  "BANKINTER::LEASING": { tipoInteresAnual: 0.0225, fechaPrimerVencimientoFutura: "" },
  "BANKINTER::PRESTAMO  COVID  ICO": { tipoInteresAnual: 0.0225, fechaPrimerVencimientoFutura: "" },
};

function parseBancos(wb: XLSX.WorkBook, warnings: string[]): ProductoImportado[] {
  const pool = wb.Sheets["Pool Bancario"];
  const situacion = wb.Sheets["Situación Bancaria"];
  if (!pool) throw new Error("No se encontró la hoja Pool Bancario");

  const productos: ProductoImportado[] = [];
  let entidadActual: string | null = null;
  const maxRow = lastRow(pool);

  for (let r = 6; r <= maxRow; r++) {
    const b = cellText(pool, r, 2); // Entidad
    const c = cellText(pool, r, 3); // Producto

    if (c && c.toUpperCase().includes("TOTAL BANCOS")) break;
    if (!c || c.toUpperCase().startsWith("SUBTOTAL")) continue;
    if (b) entidadActual = b;
    if (!entidadActual) continue;

    productos.push({
      entidad: entidadActual,
      tipo: inferirTipoProducto(c),
      nombre: c,
      capitalInicial: cellNumber(pool, r, 4), // D límite concedido
      pendienteManual: cellNumber(pool, r, 5), // E pendiente
      dispuesto: null,
      disponible: cellNumber(pool, r, 6), // F
      tipoInteresTexto: cellText(pool, r, 7), // G
      tipoInteresAnual: parseTipoInteresAnual(cellText(pool, r, 7)),
      cuotaMensual: cellNumber(pool, r, 8), // H
      fechaConstitucion: null,
      fechaPrimerVencimiento: null,
      fechaVencimiento: cellDate(pool, r, 9), // I
      numCuotas: null,
      observaciones: null,
    });
  }

  // Rellenamos tipoInteresAnual con los valores exactos verificados en
  // Amortizaciones cuando el texto de Pool Bancario no se pudo parsear bien
  // (p.ej. "EUR+1% VARIABLE" o el implícito calculado de Caixa ICO).
  for (const p of productos) {
    const key = `${p.entidad}::${p.nombre}`;
    const params = AMORTIZACION_PARAMS[key];
    if (params) p.tipoInteresAnual = params.tipoInteresAnual;
  }

  // Saldos en cuenta corriente (no aparecen en Pool Bancario, solo en
  // Situación Bancaria). Se tratan como "disponible" inmediato.
  const CUENTAS_CORRIENTES: Array<{ entidad: string; fila: number }> = [
    { entidad: "BANCO SABADELL", fila: 4 },
    { entidad: "BANKINTER", fila: 10 },
    { entidad: "CAIXABANK", fila: 15 },
    { entidad: "SANTANDER", fila: 18 },
  ];
  if (situacion) {
    for (const { entidad, fila } of CUENTAS_CORRIENTES) {
      // Columna G ("DISPONIBLE"), no D ("INICIAL"): para la cuenta de La
      // Caixa el Excel trae un disponible algo distinto del saldo inicial.
      const saldo = cellNumber(situacion, fila, 7) ?? cellNumber(situacion, fila, 4);
      if (saldo === null) continue;
      productos.push({
        entidad,
        tipo: "CUENTA",
        nombre: "Cuenta corriente",
        capitalInicial: null,
        pendienteManual: null,
        dispuesto: null,
        disponible: saldo,
        tipoInteresTexto: null,
        tipoInteresAnual: null,
        cuotaMensual: null,
        fechaConstitucion: null,
        fechaPrimerVencimiento: null,
        fechaVencimiento: null,
        numCuotas: null,
        observaciones: null,
      });
    }
  }

  // Préstamos especiales fuera del pool bancario habitual (Situación Bancaria filas 22-23).
  if (situacion) {
    const ivfNombre = cellText(situacion, 22, 2);
    if (ivfNombre) {
      productos.push({
        entidad: "IVF (Institut Valencià de Finances)",
        tipo: "PRESTAMO",
        nombre: ivfNombre,
        capitalInicial: cellNumber(situacion, 22, 4),
        pendienteManual: cellNumber(situacion, 22, 5),
        dispuesto: null,
        disponible: null,
        tipoInteresTexto: null,
        tipoInteresAnual: 0,
        cuotaMensual: cellNumber(situacion, 22, 9),
        fechaConstitucion: null,
        fechaPrimerVencimiento: new Date(Date.UTC(2026, 8, 15)), // 15/09/2026, según observación del Excel
        fechaVencimiento: cellDate(situacion, 22, 13),
        numCuotas: null,
        observaciones: cellText(situacion, 22, 14),
      });
    }

    const aeatNombre = cellText(situacion, 23, 2);
    if (aeatNombre) {
      productos.push({
        entidad: "AEAT",
        tipo: "PRESTAMO",
        nombre: aeatNombre,
        capitalInicial: cellNumber(situacion, 23, 4),
        pendienteManual: cellNumber(situacion, 23, 5),
        dispuesto: null,
        disponible: null,
        tipoInteresTexto: null,
        tipoInteresAnual: 0,
        cuotaMensual: cellNumber(situacion, 23, 9),
        fechaConstitucion: null,
        fechaPrimerVencimiento: new Date(Date.UTC(2027, 0, 5)), // 05/01/2027, según observación del Excel
        fechaVencimiento: cellDate(situacion, 23, 13),
        numCuotas: null,
        observaciones: cellText(situacion, 23, 14),
      });
    }
  }

  // La fecha de "próximo vencimiento" para los préstamos con cuadro estándar
  // se aproxima al primer día del mes siguiente a la importación, sobre el
  // mismo día del mes que su vencimiento final (cadencia mensual). Se afina
  // sola en cuanto haya pagos reales registrados en la app para esos meses.
  const proximoMes = new Date();
  proximoMes.setUTCDate(1);
  proximoMes.setUTCMonth(proximoMes.getUTCMonth() + 1);
  for (const p of productos) {
    if (p.tipo === "PRESTAMO" || p.tipo === "LEASING") {
      if (!p.fechaPrimerVencimiento && p.fechaVencimiento) {
        const dia = Math.min(p.fechaVencimiento.getUTCDate(), 28);
        p.fechaPrimerVencimiento = new Date(Date.UTC(proximoMes.getUTCFullYear(), proximoMes.getUTCMonth(), dia));
      }
    }
  }

  if (productos.length === 0) warnings.push("No se encontraron productos financieros en Pool Bancario.");

  return productos;
}

// ---------------------------------------------------------------------------
// SUPUESTOS DE PROYECCIÓN DE TESORERÍA
// ---------------------------------------------------------------------------

function parseSupuestoTesoreria(wb: XLSX.WorkBook): Prisma.SupuestoTesoreriaCreateInput {
  const sheet = wb.Sheets["Proyeccion Tesoreria"];
  if (!sheet) throw new Error("No se encontró la hoja Proyeccion Tesoreria");

  const n = (r: number) => cellNumber(sheet, r, 3) ?? 0; // columna C

  return {
    facturacionMensual: n(6),
    desfaseCobroMeses: n(7),
    pagosProveedoresMes: n(8),
    gastosFijosMes: n(9),
    saldoInicialCuentas: n(10),
    saldoInicialCuentasPolizas: n(11),
    lineaFinanciacionCaixabank: n(12),
    letrasEnCartera: n(13),
    pctLetrasCobradasPrimerMes: n(14),
    albaranesGirosACobrar: n(15),
    seguroNavePrimaAnual: n(16),
    pagoMod111Trimestre: n(17),
    previsionMensual: n(18),
    fechaInicioProyeccion: cellDate(sheet, 20, 3) ?? new Date(),
    mesesProyeccion: 23,
  };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  if (!filePath) {
    console.error("Uso: npm run import:excel -- /ruta/al/excel.xlsx [--dry-run] [--force]");
    process.exit(1);
  }

  const absPath = resolve(filePath);
  const buffer = readFileSync(absPath);
  const hash = createHash("sha256").update(buffer).digest("hex");

  if (!force && !dryRun) {
    const previa = await prisma.importacionLog.findUnique({ where: { hashContenido: hash } });
    if (previa) {
      console.log(
        `⚠ Este fichero exacto ya se importó el ${previa.ejecutadoEn.toISOString()}. ` +
          `Usa --force si de verdad quieres volver a importarlo (puede duplicar datos).`
      );
      process.exit(0);
    }
  }

  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const warnings: string[] = [];

  const pagos = parsePagos(wb, warnings);
  const cobros = parseCobros(wb);
  const cobrosEspeciales = parseCobrosEspeciales(wb, warnings);
  const productos = parseBancos(wb, warnings);
  const supuesto = parseSupuestoTesoreria(wb);

  console.log("Resumen de importación");
  console.log("=======================");
  console.log(`Pagos:              ${pagos.length}`);
  console.log(`Cobros:             ${cobros.length}`);
  console.log(`Cobros especiales:  ${cobrosEspeciales.length}`);
  console.log(`Productos bancarios:${productos.length}`);
  console.log(`Entidades:          ${new Set(productos.map((p) => p.entidad)).size}`);

  if (warnings.length) {
    console.log(`\nAvisos (${warnings.length}):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: no se ha escrito nada en la base de datos.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (pagos.length) {
      await tx.pago.createMany({ data: pagos });
    }
    if (cobros.length) {
      await tx.cobro.createMany({ data: cobros });
    }
    if (cobrosEspeciales.length) {
      await tx.cobroEspecial.createMany({ data: cobrosEspeciales });
    }

    const entidadesUnicas = Array.from(new Set(productos.map((p) => p.entidad)));
    const entidadIdPorNombre = new Map<string, string>();
    for (const nombre of entidadesUnicas) {
      const entidad = await tx.entidadFinanciera.upsert({
        where: { nombre },
        update: {},
        create: { nombre },
      });
      entidadIdPorNombre.set(nombre, entidad.id);
    }

    for (const p of productos) {
      await tx.productoFinanciero.create({
        data: {
          entidadId: entidadIdPorNombre.get(p.entidad)!,
          tipo: p.tipo,
          nombre: p.nombre,
          capitalInicial: p.capitalInicial,
          pendienteManual: p.pendienteManual,
          dispuesto: p.dispuesto,
          disponible: p.disponible,
          tipoInteresTexto: p.tipoInteresTexto,
          tipoInteresAnual: p.tipoInteresAnual,
          cuotaMensual: p.cuotaMensual,
          fechaConstitucion: p.fechaConstitucion,
          fechaPrimerVencimiento: p.fechaPrimerVencimiento,
          fechaVencimiento: p.fechaVencimiento,
          numCuotas: p.numCuotas,
          observaciones: p.observaciones,
        },
      });
    }

    await tx.supuestoTesoreria.create({ data: supuesto });

    await tx.importacionLog.create({
      data: {
        archivo: filePath,
        hashContenido: hash,
        filasPagos: pagos.length,
        filasCobros: cobros.length,
      },
    });
  });

  console.log("\n✔ Importación completada.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
