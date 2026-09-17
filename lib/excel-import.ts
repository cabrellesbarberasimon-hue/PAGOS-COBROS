// Utilidades de parseo de Excel/CSV compartidas entre el script de carga
// inicial (scripts/import-excel.ts) y la pantalla web "Importar Excel", que
// se usa para altas masivas puntuales de pagos y cobros nuevos.
import * as XLSX from "xlsx";
import { SituacionPago, TipoCobro } from "@prisma/client";
import { classifyPartida, extractProveedor } from "./partidas";

export function cell(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  return sheet[addr]?.v ?? null;
}

export function cellDate(sheet: XLSX.WorkSheet, row: number, col: number): Date | null {
  const v = cell(sheet, row, col);
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  return null;
}

export function cellNumber(sheet: XLSX.WorkSheet, row: number, col: number): number | null {
  const v = cell(sheet, row, col);
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

export function cellText(sheet: XLSX.WorkSheet, row: number, col: number): string | null {
  const v = cell(sheet, row, col);
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

export function lastRow(sheet: XLSX.WorkSheet): number {
  const ref = sheet["!ref"];
  if (!ref) return 0;
  return XLSX.utils.decode_range(ref).e.r + 1;
}

// Split de una línea CSV respetando campos entre comillas dobles (para
// observaciones/nombres que puedan contener comas).
function splitCsvLine(linea: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let dentroComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (ch === '"') {
      if (dentroComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        dentroComillas = !dentroComillas;
      }
    } else if (ch === "," && !dentroComillas) {
      campos.push(actual);
      actual = "";
    } else {
      actual += ch;
    }
  }
  campos.push(actual);
  return campos;
}

function hoy(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export interface PagoImportado {
  situacion: SituacionPago;
  estado: "PENDIENTE" | "PAGADO";
  fechaFactura: Date | null;
  fechaPago: Date;
  observacion: string;
  proveedor: string | null;
  partida: ReturnType<typeof classifyPartida>;
  importe: number;
}

/** Parsea la hoja PAGOS con el formato completo del Excel original (tabla B:G + tabla histórica X:AB). */
export function parsePagosSheetCompleto(wb: XLSX.WorkBook, warnings: string[]): PagoImportado[] {
  const sheet = wb.Sheets["PAGOS"];
  if (!sheet) throw new Error("El Excel no tiene una hoja llamada PAGOS");

  const resultado: PagoImportado[] = [];
  const HOY = hoy();
  const maxRow = lastRow(sheet);

  for (let r = 5; r <= maxRow; r++) {
    const observacion = cellText(sheet, r, 5);
    if (!observacion) continue;
    const fechaPago = cellDate(sheet, r, 4);
    const giro = cellNumber(sheet, r, 6);
    const trf = cellNumber(sheet, r, 7);
    const importe = giro ?? trf ?? null;
    if (!fechaPago || importe === null) {
      warnings.push(`PAGOS!E${r} ("${observacion}"): fila incompleta, se omite.`);
      continue;
    }
    const situacionRaw = cellText(sheet, r, 2);
    const situacion: SituacionPago =
      situacionRaw === "01" ? "GIRO" : situacionRaw === "05" ? "TRANSFERENCIA" : giro !== null ? "GIRO" : "TRANSFERENCIA";
    resultado.push({
      situacion,
      estado: fechaPago <= HOY ? "PAGADO" : "PENDIENTE",
      fechaFactura: cellDate(sheet, r, 3),
      fechaPago,
      observacion,
      proveedor: extractProveedor(observacion),
      partida: classifyPartida(observacion),
      importe,
    });
  }

  for (let r = 2; r <= maxRow; r++) {
    const observacion = cellText(sheet, r, 27);
    if (!observacion) continue;
    const fechaPago = cellDate(sheet, r, 26);
    const total = cellNumber(sheet, r, 28);
    if (!fechaPago || total === null) continue;
    const situacionRaw = cellNumber(sheet, r, 24);
    resultado.push({
      situacion: situacionRaw === 1 ? "GIRO" : "TRANSFERENCIA",
      estado: "PAGADO",
      fechaFactura: cellDate(sheet, r, 25),
      fechaPago,
      observacion,
      proveedor: extractProveedor(observacion),
      partida: classifyPartida(observacion),
      importe: total,
    });
  }

  return resultado;
}

function normalizarCabecera(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .trim()
    .toLowerCase();
}

/**
 * Parsea una hoja de pagos con formato "plano": una fila de cabecera con los
 * nombres de columna (en cualquier orden) y una fila por pago debajo, sin
 * las posiciones fijas del Excel histórico original. Pensado para
 * exportaciones de otras herramientas (CRM, banca online, etc.) que usan
 * las mismas columnas conceptuales — situación, fecha, observación, total,
 * fecha de factura — pero en otro orden o con otra cabecera.
 */
export function parsePagosGenerico(wb: XLSX.WorkBook, warnings: string[]): PagoImportado[] {
  const nombreHoja = wb.SheetNames.find((n) => n.toUpperCase().includes("PAGO")) ?? wb.SheetNames[0];
  const sheet = wb.Sheets[nombreHoja];
  if (!sheet) throw new Error("El Excel no tiene ninguna hoja con datos.");

  const maxRow = lastRow(sheet);
  const maxCol = 20;

  let headerRow = -1;
  let colSituacion = -1;
  let colFechaPago = -1;
  let colObservacion = -1;
  let colImporte = -1;
  let colFechaFactura = -1;

  for (let r = 1; r <= Math.min(5, maxRow); r++) {
    let encontrados = 0;
    const cols = { situacion: -1, fechaPago: -1, observacion: -1, importe: -1, fechaFactura: -1 };
    for (let c = 1; c <= maxCol; c++) {
      const h = normalizarCabecera(cell(sheet, r, c));
      if (!h) continue;
      if (h.includes("situacion")) {
        cols.situacion = c;
        encontrados++;
      } else if (h.includes("factura")) {
        cols.fechaFactura = c;
        encontrados++;
      } else if (h === "fecha" || h.includes("fecha pago") || h.includes("fecha de pago")) {
        cols.fechaPago = c;
        encontrados++;
      } else if (h.includes("observacion")) {
        cols.observacion = c;
        encontrados++;
      } else if (h.includes("total") || h.includes("importe")) {
        cols.importe = c;
        encontrados++;
      }
    }
    // Consideramos que es la fila de cabecera si reconocemos al menos
    // observación, fecha de pago e importe.
    if (cols.observacion !== -1 && cols.fechaPago !== -1 && cols.importe !== -1) {
      headerRow = r;
      colSituacion = cols.situacion;
      colFechaPago = cols.fechaPago;
      colObservacion = cols.observacion;
      colImporte = cols.importe;
      colFechaFactura = cols.fechaFactura;
      break;
    }
  }

  if (headerRow === -1) {
    throw new Error(
      'No se reconoce el formato de esta hoja de pagos. Debe tener una fila de cabecera con columnas de ' +
        '"Observación", "Fecha" (de pago) e "Importe"/"Total" (y opcionalmente "Situación" y "Fecha de factura").'
    );
  }

  const resultado: PagoImportado[] = [];
  const HOY = hoy();

  for (let r = headerRow + 1; r <= maxRow; r++) {
    const observacion = cellText(sheet, r, colObservacion);
    if (!observacion) continue;

    const fechaPago = cellDate(sheet, r, colFechaPago);
    const importe = cellNumber(sheet, r, colImporte);

    if (!fechaPago || importe === null) {
      warnings.push(`Fila ${r} ("${observacion}"): sin fecha de pago o sin importe, se omite.`);
      continue;
    }

    let situacion: SituacionPago = "TRANSFERENCIA";
    if (colSituacion !== -1) {
      const raw = cellText(sheet, r, colSituacion)?.replace(/^0+/, "") || "";
      if (raw === "1") situacion = "GIRO";
      else if (raw === "5") situacion = "TRANSFERENCIA";
      else if (raw) {
        warnings.push(`Fila ${r} ("${observacion}"): código de situación "${raw}" no reconocido, se asume Transferencia.`);
      }
    }

    resultado.push({
      situacion,
      estado: fechaPago <= HOY ? "PAGADO" : "PENDIENTE",
      fechaFactura: colFechaFactura !== -1 ? cellDate(sheet, r, colFechaFactura) : null,
      fechaPago,
      observacion,
      proveedor: extractProveedor(observacion),
      partida: classifyPartida(observacion),
      importe,
    });
  }

  return resultado;
}

/** Parsea un CSV sencillo de pagos: cabecera fecha_pago,situacion,observacion,importe[,fecha_factura] */
export function parsePagosCsv(texto: string): { pagos: PagoImportado[]; warnings: string[] } {
  const warnings: string[] = [];
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length < 2) return { pagos: [], warnings: ["El CSV no tiene filas de datos."] };

  const headers = splitCsvLine(lineas[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);

  const iFecha = idx("fecha_pago");
  const iSituacion = idx("situacion");
  const iObs = idx("observacion");
  const iImporte = idx("importe");
  const iFechaFactura = idx("fecha_factura");

  if (iFecha === -1 || iObs === -1 || iImporte === -1) {
    return {
      pagos: [],
      warnings: ["Cabecera esperada: fecha_pago,situacion,observacion,importe[,fecha_factura]"],
    };
  }

  const pagos: PagoImportado[] = [];
  const HOY = hoy();

  for (let i = 1; i < lineas.length; i++) {
    const cols = splitCsvLine(lineas[i]);
    const observacion = cols[iObs]?.trim();
    const fechaPago = cols[iFecha] ? new Date(cols[iFecha].trim()) : null;
    const importe = parseFloat((cols[iImporte] ?? "").replace(",", "."));

    if (!observacion || !fechaPago || Number.isNaN(fechaPago.getTime()) || Number.isNaN(importe)) {
      warnings.push(`Fila ${i + 1}: datos incompletos o inválidos, se omite.`);
      continue;
    }

    const situacionRaw = (iSituacion !== -1 ? cols[iSituacion]?.trim().toUpperCase() : "") || "TRANSFERENCIA";
    const situacion: SituacionPago = situacionRaw.startsWith("G") ? "GIRO" : "TRANSFERENCIA";
    const fechaFactura = iFechaFactura !== -1 && cols[iFechaFactura]?.trim() ? new Date(cols[iFechaFactura].trim()) : null;

    pagos.push({
      situacion,
      estado: fechaPago <= HOY ? "PAGADO" : "PENDIENTE",
      fechaFactura: fechaFactura && !Number.isNaN(fechaFactura.getTime()) ? fechaFactura : null,
      fechaPago,
      observacion,
      proveedor: extractProveedor(observacion),
      partida: classifyPartida(observacion),
      importe,
    });
  }

  return { pagos, warnings };
}

export interface CobroImportado {
  tipo: TipoCobro;
  fechaFactura: Date | null;
  fechaVencimiento: Date | null;
  factura: string;
  observacion: string | null;
  importeTalon: number | null;
  importeTransferencia: number | null;
  importeIncidencia: number | null;
  importeDevolucion: number | null;
}

export function parseCobrosSheetCompleto(wb: XLSX.WorkBook): CobroImportado[] {
  const sheet = wb.Sheets["COBROS"];
  if (!sheet) throw new Error("El Excel no tiene una hoja llamada COBROS");

  function tabla(startRow: number, tipo: TipoCobro): CobroImportado[] {
    const resultado: CobroImportado[] = [];
    const maxRow = lastRow(sheet);
    for (let r = startRow; r <= maxRow; r++) {
      const facturaRaw = cell(sheet, r, 4);
      if (typeof facturaRaw === "string" && facturaRaw.trim().toUpperCase() === "TOTAL") break;
      const factura = cellText(sheet, r, 4);
      if (!factura) continue;
      resultado.push({
        tipo,
        fechaFactura: cellDate(sheet, r, 2),
        fechaVencimiento: cellDate(sheet, r, 3),
        factura,
        observacion: cellText(sheet, r, 7),
        importeTalon: tipo === "NORMAL" ? cellNumber(sheet, r, 5) : null,
        importeTransferencia: tipo === "NORMAL" ? cellNumber(sheet, r, 6) : null,
        importeIncidencia: tipo === "INCIDENCIA_DEVOLUCION" ? cellNumber(sheet, r, 5) : null,
        importeDevolucion: tipo === "INCIDENCIA_DEVOLUCION" ? cellNumber(sheet, r, 6) : null,
      });
    }
    return resultado;
  }

  return [...tabla(3, "NORMAL"), ...tabla(13, "INCIDENCIA_DEVOLUCION")];
}

/** CSV sencillo: fecha_factura,fecha_vencimiento,factura,talon,transferencia,observacion */
export function parseCobrosCsv(texto: string): { cobros: CobroImportado[]; warnings: string[] } {
  const warnings: string[] = [];
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length < 2) return { cobros: [], warnings: ["El CSV no tiene filas de datos."] };

  const headers = splitCsvLine(lineas[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);

  const iFF = idx("fecha_factura");
  const iFV = idx("fecha_vencimiento");
  const iFactura = idx("factura");
  const iTalon = idx("talon");
  const iTrf = idx("transferencia");
  const iObs = idx("observacion");

  if (iFactura === -1) {
    return {
      cobros: [],
      warnings: ["Cabecera esperada: fecha_factura,fecha_vencimiento,factura,talon,transferencia,observacion"],
    };
  }

  const cobros: CobroImportado[] = [];
  for (let i = 1; i < lineas.length; i++) {
    const cols = splitCsvLine(lineas[i]);
    const factura = cols[iFactura]?.trim();
    if (!factura) {
      warnings.push(`Fila ${i + 1}: sin factura, se omite.`);
      continue;
    }
    const parseFecha = (idx: number) => {
      if (idx === -1 || !cols[idx]?.trim()) return null;
      const d = new Date(cols[idx].trim());
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const parseImporte = (idx: number) => {
      if (idx === -1 || !cols[idx]?.trim()) return null;
      const n = parseFloat(cols[idx].trim().replace(",", "."));
      return Number.isNaN(n) ? null : n;
    };

    cobros.push({
      tipo: "NORMAL",
      fechaFactura: parseFecha(iFF),
      fechaVencimiento: parseFecha(iFV),
      factura,
      observacion: iObs !== -1 ? cols[iObs]?.trim() || null : null,
      importeTalon: parseImporte(iTalon),
      importeTransferencia: parseImporte(iTrf),
      importeIncidencia: null,
      importeDevolucion: null,
    });
  }

  return { cobros, warnings };
}
