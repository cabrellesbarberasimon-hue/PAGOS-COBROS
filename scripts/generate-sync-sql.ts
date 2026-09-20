/**
 * Genera SQL para SINCRONIZAR la base de datos con una versión actualizada
 * del Excel completo, SIN duplicar lo que ya hay en producción:
 *
 *  - Pagos:              se inserta solo si no existe ya una fila con la
 *                         misma observación + fecha de pago.
 *  - Cobros:              igual, por factura + fecha de vencimiento.
 *  - Cobros especiales:   igual, por categoría + cliente/factura.
 *  - Entidades:           se reutiliza la existente (nombre único).
 *  - Productos financieros: se ACTUALIZAN si ya existe uno con la misma
 *                         entidad + nombre (saldos, cuotas, vencimientos...),
 *                         o se crea si no existía.
 *  - Supuesto de proyección: se ACTUALIZA la fila existente (sin tocar los
 *                         3 insumos manuales del Informe de posición, que no
 *                         vienen del Excel), o se crea si no había ninguna.
 *
 * Uso:
 *   npx tsx scripts/generate-sync-sql.ts /ruta/al/excel-actualizado.xlsx [directorio-salida]
 *
 * El editor SQL de Neon solo admite ~100.000 caracteres por ejecución, así
 * que en vez de un único fichero, esto escribe varios ficheros
 * "sync-parteN-de-M.sql" (cada uno por debajo del límite, y cada uno ya
 * envuelto en su propio bloque DO — una sola sentencia) para pegarlos y
 * ejecutarlos uno detrás de otro, en orden.
 *
 * Igual que generate-import-sql.ts, no necesita conexión a base de datos:
 * el SQL resultante se pega en el editor SQL de Neon/Vercel.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import * as XLSX from "xlsx";
import { parsePagosSheetCompleto, parseCobrosSheetCompleto } from "../lib/excel-import";
import { parseCobrosEspeciales, parseBancos, parseSupuestoTesoreria } from "./import-excel";
import { sqlStr, sqlNum, sqlDate, sqlEqNullSafe } from "./sql-helpers";

// Margen de sobra bajo el límite real de Neon (~100.000 caracteres), para
// dejar sitio a la envoltura DO $SYNC_N$ ... END $SYNC_N$; de cada parte.
const LIMITE_CARACTERES_POR_PARTE = 90000;

function dividirEnPartes(lineas: string[], limite: number): string[][] {
  const partes: string[][] = [];
  let actual: string[] = [];
  let longitudActual = 0;

  for (const linea of lineas) {
    // Una sola línea nunca debería superar el límite ella sola en la práctica,
    // pero por si acaso no la partimos a mitad (una fila de INSERT rota no
    // seria SQL válido).
    if (longitudActual + linea.length + 1 > limite && actual.length > 0) {
      partes.push(actual);
      actual = [];
      longitudActual = 0;
    }
    actual.push(linea);
    longitudActual += linea.length + 1;
  }
  if (actual.length > 0) partes.push(actual);

  return partes;
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: npx tsx scripts/generate-sync-sql.ts /ruta/al/excel.xlsx [directorio-salida]");
    process.exit(1);
  }
  const outDir = process.argv[3] ? resolve(process.argv[3]) : process.cwd();

  const buffer = readFileSync(resolve(filePath));
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const warnings: string[] = [];

  const pagos = parsePagosSheetCompleto(wb, warnings);
  const cobros = parseCobrosSheetCompleto(wb);
  const cobrosEspeciales = parseCobrosEspeciales(wb, warnings);
  const productos = parseBancos(wb, warnings);
  const supuesto = parseSupuestoTesoreria(wb);

  const out: string[] = [];

  if (pagos.length) {
    out.push("-- Pagos (se insertan solo si no existen ya: misma observación + fecha de pago)");
    for (const p of pagos) {
      const now = new Date();
      const obs = sqlStr(p.observacion);
      const fp = sqlDate(p.fechaPago);
      out.push(
        `INSERT INTO "Pago" (id, situacion, estado, "fechaFactura", "fechaPago", observacion, proveedor, partida, importe, "createdAt", "updatedAt") ` +
          `SELECT ${sqlStr(randomUUID())}, ${sqlStr(p.situacion)}, ${sqlStr(p.estado)}, ${sqlDate(p.fechaFactura)}, ${fp}, ${obs}, ${sqlStr(
            p.proveedor
          )}, ${sqlStr(p.partida)}, ${sqlNum(p.importe)}, ${sqlDate(now)}, ${sqlDate(now)} ` +
          `WHERE NOT EXISTS (SELECT 1 FROM "Pago" WHERE lower(trim(observacion)) = lower(trim(${obs})) AND "fechaPago" = ${fp});`
      );
    }
    out.push("");
  }

  if (cobros.length) {
    out.push("-- Cobros (se insertan solo si no existen ya: misma factura + fecha de vencimiento)");
    for (const c of cobros) {
      const now = new Date();
      const factura = sqlStr(c.factura);
      const fv = sqlDate(c.fechaVencimiento);
      out.push(
        `INSERT INTO "Cobro" (id, tipo, "fechaFactura", "fechaVencimiento", factura, observacion, "importeTalon", "importeTransferencia", "importeIncidencia", "importeDevolucion", "createdAt", "updatedAt") ` +
          `SELECT ${sqlStr(randomUUID())}, ${sqlStr(c.tipo)}, ${sqlDate(c.fechaFactura)}, ${fv}, ${factura}, ${sqlStr(
            c.observacion
          )}, ${sqlNum(c.importeTalon)}, ${sqlNum(c.importeTransferencia)}, ${sqlNum(c.importeIncidencia)}, ${sqlNum(
            c.importeDevolucion
          )}, ${sqlDate(now)}, ${sqlDate(now)} ` +
          `WHERE NOT EXISTS (SELECT 1 FROM "Cobro" WHERE lower(trim(factura)) = lower(trim(${factura})) AND ${sqlEqNullSafe(
            '"fechaVencimiento"',
            fv
          )});`
      );
    }
    out.push("");
  }

  if (cobrosEspeciales.length) {
    out.push("-- Cobros especiales (se insertan solo si no existen ya: misma categoría + cliente/factura)");
    for (const ce of cobrosEspeciales) {
      const now = new Date();
      const cliente = sqlStr(ce.clienteFactura);
      const categoria = sqlStr(ce.categoria);
      out.push(
        `INSERT INTO "CobroEspecial" (id, categoria, "clienteFactura", importe, observaciones, "createdAt", "updatedAt") ` +
          `SELECT ${sqlStr(randomUUID())}, ${categoria}, ${cliente}, ${sqlNum(ce.importe)}, ${sqlStr(
            ce.observaciones
          )}, ${sqlDate(now)}, ${sqlDate(now)} ` +
          `WHERE NOT EXISTS (SELECT 1 FROM "CobroEspecial" WHERE categoria = ${categoria} AND lower(trim("clienteFactura")) = lower(trim(${cliente})));`
      );
    }
    out.push("");
  }

  if (productos.length) {
    out.push("-- Entidades financieras (se reutiliza la existente si el nombre ya existe)");
    const entidadesUnicas = Array.from(new Set(productos.map((p) => p.entidad)));
    for (const nombre of entidadesUnicas) {
      const now = new Date();
      out.push(
        `INSERT INTO "EntidadFinanciera" (id, nombre, "createdAt", "updatedAt") VALUES (${sqlStr(randomUUID())}, ${sqlStr(
          nombre
        )}, ${sqlDate(now)}, ${sqlDate(now)}) ON CONFLICT (nombre) DO NOTHING;`
      );
    }
    out.push("");

    out.push("-- Productos financieros (se actualizan los existentes; se crean los que falten)");
    for (const p of productos) {
      const now = new Date();
      const entidad = sqlStr(p.entidad);
      const nombre = sqlStr(p.nombre);

      out.push(
        `UPDATE "ProductoFinanciero" SET tipo = ${sqlStr(p.tipo)}, "capitalInicial" = ${sqlNum(
          p.capitalInicial
        )}, "pendienteManual" = ${sqlNum(p.pendienteManual)}, dispuesto = ${sqlNum(p.dispuesto)}, disponible = ${sqlNum(
          p.disponible
        )}, "tipoInteresTexto" = ${sqlStr(p.tipoInteresTexto)}, "tipoInteresAnual" = ${sqlNum(
          p.tipoInteresAnual
        )}, "cuotaMensual" = ${sqlNum(p.cuotaMensual)}, "fechaConstitucion" = ${sqlDate(
          p.fechaConstitucion
        )}, "fechaPrimerVencimiento" = ${sqlDate(p.fechaPrimerVencimiento)}, "fechaVencimiento" = ${sqlDate(
          p.fechaVencimiento
        )}, "numCuotas" = ${sqlNum(p.numCuotas)}, observaciones = ${sqlStr(p.observaciones)}, "updatedAt" = ${sqlDate(now)} ` +
          `WHERE "entidadId" = (SELECT id FROM "EntidadFinanciera" WHERE nombre = ${entidad}) AND nombre = ${nombre};`
      );

      out.push(
        `INSERT INTO "ProductoFinanciero" (id, "entidadId", tipo, nombre, "capitalInicial", "pendienteManual", dispuesto, disponible, "tipoInteresTexto", "tipoInteresAnual", "cuotaMensual", "fechaConstitucion", "fechaPrimerVencimiento", "fechaVencimiento", "numCuotas", observaciones, "createdAt", "updatedAt") ` +
          `SELECT ${sqlStr(randomUUID())}, e.id, ${sqlStr(p.tipo)}, ${nombre}, ${sqlNum(p.capitalInicial)}, ${sqlNum(
            p.pendienteManual
          )}, ${sqlNum(p.dispuesto)}, ${sqlNum(p.disponible)}, ${sqlStr(p.tipoInteresTexto)}, ${sqlNum(
            p.tipoInteresAnual
          )}, ${sqlNum(p.cuotaMensual)}, ${sqlDate(p.fechaConstitucion)}, ${sqlDate(p.fechaPrimerVencimiento)}, ${sqlDate(
            p.fechaVencimiento
          )}, ${sqlNum(p.numCuotas)}, ${sqlStr(p.observaciones)}, ${sqlDate(now)}, ${sqlDate(now)} ` +
          `FROM "EntidadFinanciera" e WHERE e.nombre = ${entidad} ` +
          `AND NOT EXISTS (SELECT 1 FROM "ProductoFinanciero" pf WHERE pf."entidadId" = e.id AND pf.nombre = ${nombre});`
      );
    }
    out.push("");
  }

  out.push("-- Supuestos de proyección de tesorería (se actualiza el existente; no se tocan los");
  out.push("-- 3 insumos manuales del Informe de posición, que no vienen del Excel)");
  {
    const now = new Date();
    const cols = {
      facturacionMensual: sqlNum(supuesto.facturacionMensual as number),
      desfaseCobroMeses: sqlNum(supuesto.desfaseCobroMeses as number),
      pagosProveedoresMes: sqlNum(supuesto.pagosProveedoresMes as number),
      gastosFijosMes: sqlNum(supuesto.gastosFijosMes as number),
      saldoInicialCuentas: sqlNum(supuesto.saldoInicialCuentas as number),
      saldoInicialCuentasPolizas: sqlNum(supuesto.saldoInicialCuentasPolizas as number),
      lineaFinanciacionCaixabank: sqlNum(supuesto.lineaFinanciacionCaixabank as number),
      letrasEnCartera: sqlNum(supuesto.letrasEnCartera as number),
      pctLetrasCobradasPrimerMes: sqlNum(supuesto.pctLetrasCobradasPrimerMes as number),
      albaranesGirosACobrar: sqlNum(supuesto.albaranesGirosACobrar as number),
      seguroNavePrimaAnual: sqlNum(supuesto.seguroNavePrimaAnual as number),
      pagoMod111Trimestre: sqlNum(supuesto.pagoMod111Trimestre as number),
      previsionMensual: sqlNum(supuesto.previsionMensual as number),
      fechaInicioProyeccion: sqlDate(supuesto.fechaInicioProyeccion as Date),
      mesesProyeccion: sqlNum(supuesto.mesesProyeccion as number),
    };

    out.push(
      `UPDATE "SupuestoTesoreria" SET "facturacionMensual" = ${cols.facturacionMensual}, "desfaseCobroMeses" = ${cols.desfaseCobroMeses}, "pagosProveedoresMes" = ${cols.pagosProveedoresMes}, "gastosFijosMes" = ${cols.gastosFijosMes}, "saldoInicialCuentas" = ${cols.saldoInicialCuentas}, "saldoInicialCuentasPolizas" = ${cols.saldoInicialCuentasPolizas}, "lineaFinanciacionCaixabank" = ${cols.lineaFinanciacionCaixabank}, "letrasEnCartera" = ${cols.letrasEnCartera}, "pctLetrasCobradasPrimerMes" = ${cols.pctLetrasCobradasPrimerMes}, "albaranesGirosACobrar" = ${cols.albaranesGirosACobrar}, "seguroNavePrimaAnual" = ${cols.seguroNavePrimaAnual}, "pagoMod111Trimestre" = ${cols.pagoMod111Trimestre}, "previsionMensual" = ${cols.previsionMensual}, "fechaInicioProyeccion" = ${cols.fechaInicioProyeccion}, "mesesProyeccion" = ${cols.mesesProyeccion}, "updatedAt" = ${sqlDate(now)} ` +
        `WHERE id = (SELECT id FROM "SupuestoTesoreria" ORDER BY "updatedAt" DESC LIMIT 1);`
    );

    out.push(
      `INSERT INTO "SupuestoTesoreria" (id, "facturacionMensual", "desfaseCobroMeses", "pagosProveedoresMes", "gastosFijosMes", "saldoInicialCuentas", "saldoInicialCuentasPolizas", "lineaFinanciacionCaixabank", "letrasEnCartera", "pctLetrasCobradasPrimerMes", "albaranesGirosACobrar", "seguroNavePrimaAnual", "pagoMod111Trimestre", "previsionMensual", "fechaInicioProyeccion", "mesesProyeccion", "updatedAt") ` +
        `SELECT ${sqlStr(randomUUID())}, ${cols.facturacionMensual}, ${cols.desfaseCobroMeses}, ${cols.pagosProveedoresMes}, ${cols.gastosFijosMes}, ${cols.saldoInicialCuentas}, ${cols.saldoInicialCuentasPolizas}, ${cols.lineaFinanciacionCaixabank}, ${cols.letrasEnCartera}, ${cols.pctLetrasCobradasPrimerMes}, ${cols.albaranesGirosACobrar}, ${cols.seguroNavePrimaAnual}, ${cols.pagoMod111Trimestre}, ${cols.previsionMensual}, ${cols.fechaInicioProyeccion}, ${cols.mesesProyeccion}, ${sqlDate(now)} ` +
        `WHERE NOT EXISTS (SELECT 1 FROM "SupuestoTesoreria");`
    );
  }
  const partes = dividirEnPartes(out, LIMITE_CARACTERES_POR_PARTE);
  const nombreBase = basename(filePath).replace(/\.[^.]+$/, "");

  partes.forEach((lineasParte, i) => {
    const numero = i + 1;
    const contenido = [
      `-- Sincronización generada desde ${basename(filePath)} — parte ${numero} de ${partes.length}.`,
      `-- Ejecuta las partes EN ORDEN (1, 2, 3...), cada una es una sola sentencia SQL.`,
      `DO $SYNC_${numero}$`,
      "BEGIN",
      "",
      ...lineasParte,
      "",
      `END $SYNC_${numero}$;`,
      "",
    ].join("\n");

    const nombreFichero = join(outDir, `${nombreBase}-sync-parte${numero}-de-${partes.length}.sql`);
    writeFileSync(nombreFichero, contenido, "utf-8");
    console.error(`Escrito: ${nombreFichero} (${contenido.length} caracteres)`);
  });

  console.error(
    `\n-- Leído del Excel: ${pagos.length} pagos, ${cobros.length} cobros, ${cobrosEspeciales.length} cobros especiales, ${productos.length} productos.`
  );
  console.error("-- Los pagos/cobros/cobros especiales que ya existan (misma clave) se omiten solos.");
  console.error("-- Los productos financieros y el supuesto de proyección se actualizan siempre con los valores del Excel.");
  if (warnings.length) {
    console.error(`-- Avisos (${warnings.length}):`);
    for (const w of warnings) console.error(`--   ${w}`);
  }
}

main();
