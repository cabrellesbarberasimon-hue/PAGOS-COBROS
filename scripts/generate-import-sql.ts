/**
 * Genera un fichero .sql con la carga inicial completa (Pagos, Cobros,
 * Cobros especiales, Bancos y Supuestos de Proyección) a partir del Excel
 * histórico, para poder pegarlo directamente en el editor SQL de Neon
 * cuando no hay conexión TCP directa a la base de datos disponible (p.ej.
 * ejecutando esto en un entorno con salida de red restringida a HTTPS).
 *
 * Uso:
 *   npx tsx scripts/generate-import-sql.ts /ruta/al/excel.xlsx > carga-inicial.sql
 *
 * El resultado es SQL plano, sin depender de Prisma Client ni de una
 * conexión a base de datos — se genera 100% en local y se ejecuta pegándolo
 * en la consola SQL de Neon/Vercel.
 */
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { parsePagosSheetCompleto, parseCobrosSheetCompleto } from "../lib/excel-import";
import { parseCobrosEspeciales, parseBancos, parseSupuestoTesoreria } from "./import-excel";

function sqlStr(v: string | null | undefined): string {
  if (v === null || v === undefined) return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlNum(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "NULL";
  return String(v);
}

function sqlDate(v: Date | null | undefined): string {
  if (!v) return "NULL";
  return `'${v.toISOString()}'`;
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: npx tsx scripts/generate-import-sql.ts /ruta/al/excel.xlsx > carga-inicial.sql");
    process.exit(1);
  }

  const buffer = readFileSync(resolve(filePath));
  const hash = createHash("sha256").update(buffer).digest("hex");
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const warnings: string[] = [];

  const pagos = parsePagosSheetCompleto(wb, warnings);
  const cobros = parseCobrosSheetCompleto(wb);
  const cobrosEspeciales = parseCobrosEspeciales(wb, warnings);
  const productos = parseBancos(wb, warnings);
  const supuesto = parseSupuestoTesoreria(wb);

  const out: string[] = [];
  out.push("-- Carga inicial generada desde el Excel histórico. Ejecutar una sola vez.");
  out.push("-- Todo va dentro de un único bloque DO porque algunos editores SQL");
  out.push("-- (p.ej. el de Neon) solo admiten una sentencia por ejecución.");
  out.push("DO $CARGA_INICIAL$");
  out.push("BEGIN");
  out.push("");

  if (pagos.length) {
    out.push('-- Pagos');
    for (const p of pagos) {
      const now = new Date();
      out.push(
        `INSERT INTO "Pago" (id, situacion, estado, "fechaFactura", "fechaPago", observacion, proveedor, partida, importe, "createdAt", "updatedAt") VALUES (` +
          [
            sqlStr(randomUUID()),
            sqlStr(p.situacion),
            sqlStr(p.estado),
            sqlDate(p.fechaFactura),
            sqlDate(p.fechaPago),
            sqlStr(p.observacion),
            sqlStr(p.proveedor),
            sqlStr(p.partida),
            sqlNum(p.importe),
            sqlDate(now),
            sqlDate(now),
          ].join(", ") +
          ");"
      );
    }
    out.push("");
  }

  if (cobros.length) {
    out.push("-- Cobros");
    for (const c of cobros) {
      const now = new Date();
      out.push(
        `INSERT INTO "Cobro" (id, tipo, "fechaFactura", "fechaVencimiento", factura, observacion, "importeTalon", "importeTransferencia", "importeIncidencia", "importeDevolucion", "createdAt", "updatedAt") VALUES (` +
          [
            sqlStr(randomUUID()),
            sqlStr(c.tipo),
            sqlDate(c.fechaFactura),
            sqlDate(c.fechaVencimiento),
            sqlStr(c.factura),
            sqlStr(c.observacion),
            sqlNum(c.importeTalon),
            sqlNum(c.importeTransferencia),
            sqlNum(c.importeIncidencia),
            sqlNum(c.importeDevolucion),
            sqlDate(now),
            sqlDate(now),
          ].join(", ") +
          ");"
      );
    }
    out.push("");
  }

  if (cobrosEspeciales.length) {
    out.push("-- Cobros especiales");
    for (const ce of cobrosEspeciales) {
      const now = new Date();
      out.push(
        `INSERT INTO "CobroEspecial" (id, categoria, "clienteFactura", importe, observaciones, "createdAt", "updatedAt") VALUES (` +
          [
            sqlStr(randomUUID()),
            sqlStr(ce.categoria),
            sqlStr(ce.clienteFactura),
            sqlNum(ce.importe),
            sqlStr(ce.observaciones),
            sqlDate(now),
            sqlDate(now),
          ].join(", ") +
          ");"
      );
    }
    out.push("");
  }

  if (productos.length) {
    out.push("-- Entidades financieras");
    const entidadesUnicas = Array.from(new Set(productos.map((p) => p.entidad)));
    const entidadIdPorNombre = new Map<string, string>();
    for (const nombre of entidadesUnicas) {
      const id = randomUUID();
      entidadIdPorNombre.set(nombre, id);
      const now = new Date();
      out.push(
        `INSERT INTO "EntidadFinanciera" (id, nombre, "createdAt", "updatedAt") VALUES (${sqlStr(id)}, ${sqlStr(
          nombre
        )}, ${sqlDate(now)}, ${sqlDate(now)}) ON CONFLICT (nombre) DO NOTHING;`
      );
    }
    out.push("");

    out.push("-- Productos financieros");
    for (const p of productos) {
      const now = new Date();
      out.push(
        `INSERT INTO "ProductoFinanciero" (id, "entidadId", tipo, nombre, "capitalInicial", "pendienteManual", dispuesto, disponible, "tipoInteresTexto", "tipoInteresAnual", "cuotaMensual", "fechaConstitucion", "fechaPrimerVencimiento", "fechaVencimiento", "numCuotas", observaciones, "createdAt", "updatedAt")` +
          ` SELECT ${sqlStr(randomUUID())}, id, ${sqlStr(p.tipo)}, ${sqlStr(p.nombre)}, ${sqlNum(p.capitalInicial)}, ${sqlNum(
            p.pendienteManual
          )}, ${sqlNum(p.dispuesto)}, ${sqlNum(p.disponible)}, ${sqlStr(p.tipoInteresTexto)}, ${sqlNum(
            p.tipoInteresAnual
          )}, ${sqlNum(p.cuotaMensual)}, ${sqlDate(p.fechaConstitucion)}, ${sqlDate(p.fechaPrimerVencimiento)}, ${sqlDate(
            p.fechaVencimiento
          )}, ${sqlNum(p.numCuotas)}, ${sqlStr(p.observaciones)}, ${sqlDate(now)}, ${sqlDate(now)}` +
          ` FROM "EntidadFinanciera" WHERE nombre = ${sqlStr(p.entidad)};`
      );
    }
    out.push("");
  }

  out.push("-- Supuestos de proyección de tesorería");
  out.push(
    `INSERT INTO "SupuestoTesoreria" (id, "facturacionMensual", "desfaseCobroMeses", "pagosProveedoresMes", "gastosFijosMes", "saldoInicialCuentas", "saldoInicialCuentasPolizas", "lineaFinanciacionCaixabank", "letrasEnCartera", "pctLetrasCobradasPrimerMes", "albaranesGirosACobrar", "seguroNavePrimaAnual", "pagoMod111Trimestre", "previsionMensual", "fechaInicioProyeccion", "mesesProyeccion", "updatedAt") VALUES (` +
      [
        sqlStr(randomUUID()),
        sqlNum(supuesto.facturacionMensual as number),
        sqlNum(supuesto.desfaseCobroMeses as number),
        sqlNum(supuesto.pagosProveedoresMes as number),
        sqlNum(supuesto.gastosFijosMes as number),
        sqlNum(supuesto.saldoInicialCuentas as number),
        sqlNum(supuesto.saldoInicialCuentasPolizas as number),
        sqlNum(supuesto.lineaFinanciacionCaixabank as number),
        sqlNum(supuesto.letrasEnCartera as number),
        sqlNum(supuesto.pctLetrasCobradasPrimerMes as number),
        sqlNum(supuesto.albaranesGirosACobrar as number),
        sqlNum(supuesto.seguroNavePrimaAnual as number),
        sqlNum(supuesto.pagoMod111Trimestre as number),
        sqlNum(supuesto.previsionMensual as number),
        sqlDate(supuesto.fechaInicioProyeccion as Date),
        sqlNum(supuesto.mesesProyeccion as number),
        sqlDate(new Date()),
      ].join(", ") +
      ");"
  );
  out.push("");

  out.push("-- Registro de importación (para que el script normal detecte que ya se importó este fichero)");
  out.push(
    `INSERT INTO "ImportacionLog" (id, archivo, "hashContenido", "filasPagos", "filasCobros", "ejecutadoEn") VALUES (${sqlStr(
      randomUUID()
    )}, ${sqlStr(filePath)}, ${sqlStr(hash)}, ${sqlNum(pagos.length)}, ${sqlNum(cobros.length)}, ${sqlDate(
      new Date()
    )}) ON CONFLICT ("hashContenido") DO NOTHING;`
  );
  out.push("");
  out.push("END $CARGA_INICIAL$;");

  console.log(out.join("\n"));
  console.error(`\n-- Generado: ${pagos.length} pagos, ${cobros.length} cobros, ${cobrosEspeciales.length} cobros especiales, ${productos.length} productos.`);
  if (warnings.length) {
    console.error(`-- Avisos (${warnings.length}):`);
    for (const w of warnings) console.error(`--   ${w}`);
  }
}

main();
