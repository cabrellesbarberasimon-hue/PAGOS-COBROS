import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import {
  parsePagosSheetCompleto,
  parsePagosCsv,
  parseCobrosSheetCompleto,
  parseCobrosCsv,
  type PagoImportado,
  type CobroImportado,
} from "@/lib/excel-import";

export const runtime = "nodejs";

function fechaKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function marcarDuplicadosPagos(pagos: PagoImportado[]) {
  const existentes = await prisma.pago.findMany({ select: { observacion: true, fechaPago: true } });
  const set = new Set(existentes.map((p) => `${p.observacion.trim().toLowerCase()}|${fechaKey(p.fechaPago)}`));
  return pagos.map((p) => ({
    ...p,
    duplicado: set.has(`${p.observacion.trim().toLowerCase()}|${fechaKey(p.fechaPago)}`),
  }));
}

async function marcarDuplicadosCobros(cobros: CobroImportado[]) {
  const existentes = await prisma.cobro.findMany({ select: { factura: true, fechaVencimiento: true } });
  const set = new Set(
    existentes.map((c) => `${c.factura.trim().toLowerCase()}|${c.fechaVencimiento ? fechaKey(c.fechaVencimiento) : ""}`)
  );
  return cobros.map((c) => ({
    ...c,
    duplicado: set.has(`${c.factura.trim().toLowerCase()}|${c.fechaVencimiento ? fechaKey(c.fechaVencimiento) : ""}`),
  }));
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const tipo = String(formData.get("tipo") ?? "pagos"); // 'pagos' | 'cobros'
  const confirmar = String(formData.get("confirmar") ?? "false") === "true";

  if (!file) {
    return NextResponse.json({ error: "No se ha subido ningún fichero." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const esExcel = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
  const warnings: string[] = [];

  try {
    if (tipo === "pagos") {
      let pagos: PagoImportado[];
      if (esExcel) {
        const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
        pagos = parsePagosSheetCompleto(wb, warnings);
      } else {
        const r = parsePagosCsv(buffer.toString("utf-8"));
        pagos = r.pagos;
        warnings.push(...r.warnings);
      }

      const marcados = await marcarDuplicadosPagos(pagos);
      const aInsertar = marcados.filter((p) => !p.duplicado);

      if (!confirmar) {
        return NextResponse.json({
          tipo: "pagos",
          total: marcados.length,
          duplicados: marcados.length - aInsertar.length,
          aInsertar: aInsertar.length,
          warnings,
          muestra: marcados.slice(0, 30),
        });
      }

      if (aInsertar.length > 0) {
        await prisma.pago.createMany({
          data: aInsertar.map(({ duplicado, ...p }) => p),
        });
      }

      return NextResponse.json({
        tipo: "pagos",
        insertados: aInsertar.length,
        omitidosPorDuplicado: marcados.length - aInsertar.length,
        warnings,
      });
    }

    if (tipo === "cobros") {
      let cobros: CobroImportado[];
      if (esExcel) {
        const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
        cobros = parseCobrosSheetCompleto(wb);
      } else {
        const r = parseCobrosCsv(buffer.toString("utf-8"));
        cobros = r.cobros;
        warnings.push(...r.warnings);
      }

      const marcados = await marcarDuplicadosCobros(cobros);
      const aInsertar = marcados.filter((c) => !c.duplicado);

      if (!confirmar) {
        return NextResponse.json({
          tipo: "cobros",
          total: marcados.length,
          duplicados: marcados.length - aInsertar.length,
          aInsertar: aInsertar.length,
          warnings,
          muestra: marcados.slice(0, 30),
        });
      }

      if (aInsertar.length > 0) {
        await prisma.cobro.createMany({
          data: aInsertar.map(({ duplicado, ...c }) => c),
        });
      }

      return NextResponse.json({
        tipo: "cobros",
        insertados: aInsertar.length,
        omitidosPorDuplicado: marcados.length - aInsertar.length,
        warnings,
      });
    }

    return NextResponse.json({ error: "Tipo de importación no reconocido." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al procesar el fichero.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
