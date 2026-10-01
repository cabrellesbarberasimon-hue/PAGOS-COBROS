import type Anthropic from "@anthropic-ai/sdk";
import type { Cobro, EntidadFinanciera, Pago, ProductoFinanciero, SupuestoTesoreria } from "@prisma/client";
import { prisma } from "./prisma";
import { toNumber } from "./format";
import { computeDashboardKpis } from "./kpis";
import { calcularInforme } from "./informe";
import { calcularProyeccion } from "./tesoreria";
import { calcularCentroAlertas } from "./alertas";
import { estadoColorCobro } from "./cobro-color";

// Herramientas que el Asistente IA puede invocar para responder preguntas
// sobre la tesorería con datos reales, en vez de inventar cifras. Todas
// comparten un mismo "contexto" (una sola lectura de Pagos/Cobros/Bancos/
// Supuesto por conversación) para no repetir consultas a la base de datos
// si el modelo encadena varias llamadas.

export interface AiToolContext {
  supuesto: SupuestoTesoreria | null;
  pagos: Pago[];
  cobros: Cobro[];
  productos: (ProductoFinanciero & { entidad: EntidadFinanciera })[];
}

export async function construirContextoAi(): Promise<AiToolContext> {
  const [supuesto, pagos, cobros, productos] = await Promise.all([
    prisma.supuestoTesoreria.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.pago.findMany(),
    prisma.cobro.findMany(),
    prisma.productoFinanciero.findMany({ include: { entidad: true } }),
  ]);
  return { supuesto, pagos, cobros, productos };
}

const MAX_FILAS = 50;

export const AI_TOOLS: Anthropic.Tool[] = [
  {
    name: "resumen_dashboard",
    description:
      "Devuelve los KPIs principales del dashboard: liquidez disponible, deuda total con bancos, disponible en pólizas, importes de pagos que vencen en 7/15/30 días y el total de cobros vencidos.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "informe_posicion",
    description:
      "Devuelve el Informe de posición completo de hoy: embudo de conversión a caja, calidad de liquidez, riesgo de tesorería a 30/60/90 días, capacidad financiera, KPIs de gestión y el panel de alertas de ratios.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "alertas_activas",
    description:
      "Devuelve las alertas activas ahora mismo: alertas de ratios del informe, alertas de saldo bajo por cuenta bancaria, y sugerencias de traspaso entre cuentas para cubrir un déficit.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "pagos_pendientes",
    description:
      "Lista los pagos pendientes de pago (no pagados todavía) que vencen dentro de los próximos N días, opcionalmente filtrados por partida. Devuelve como mucho 50 filas (las más próximas a vencer) más el total e importe agregado de todos los que cumplen el filtro.",
    input_schema: {
      type: "object",
      properties: {
        diasHasta: { type: "number", description: "Días hacia delante desde hoy. Por defecto 30." },
        partida: {
          type: "string",
          description: "Filtra por partida contable. Opcional.",
          enum: [
            "BANCOS",
            "TARJETAS",
            "SEGUROS",
            "PERSONAL",
            "IMPUESTOS",
            "VARIOS_PREVISION",
            "SUMINISTROS_OTROS",
            "PROVEEDORES",
            "OTROS",
          ],
        },
      },
    },
  },
  {
    name: "cobros_vencidos",
    description:
      "Lista los cobros con fecha de vencimiento ya pasada y todavía no cobrados del todo. Devuelve como mucho 50 filas más el importe total agregado.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "proyeccion_mensual",
    description:
      "Devuelve la proyección de tesorería mes a mes (saldo sin póliza, con pólizas actuales, y con línea Caixabank adicional) para los próximos N meses.",
    input_schema: {
      type: "object",
      properties: {
        meses: { type: "number", description: "Número de meses a devolver, entre 1 y 23. Por defecto 6." },
      },
    },
  },
];

function diasDesdeHoy(fecha: Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(fecha).getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}

export function ejecutarHerramientaAi(nombre: string, input: Record<string, unknown>, ctx: AiToolContext): unknown {
  switch (nombre) {
    case "resumen_dashboard": {
      const cobrosNormales = ctx.cobros.filter((c) => c.tipo === "NORMAL");
      return computeDashboardKpis(ctx.productos, ctx.pagos, cobrosNormales);
    }

    case "informe_posicion": {
      if (!ctx.supuesto) return { error: "Todavía no hay supuestos de proyección configurados en /proyeccion." };
      const informe = calcularInforme(ctx.supuesto, ctx.pagos, ctx.cobros, ctx.productos);
      const { proyeccion12Meses, ...resto } = informe;
      return resto;
    }

    case "alertas_activas": {
      // Reutiliza el mismo contexto en vez de volver a consultar la base de datos.
      return calcularCentroAlertas(ctx.supuesto, ctx.pagos, ctx.cobros, ctx.productos);
    }

    case "pagos_pendientes": {
      const diasHasta = typeof input.diasHasta === "number" ? input.diasHasta : 30;
      const partida = typeof input.partida === "string" ? input.partida : null;
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const limite = new Date(hoy.getTime() + diasHasta * 24 * 60 * 60 * 1000);

      const filtrados = ctx.pagos
        .filter((p) => p.estado === "PENDIENTE" && p.fechaPago >= hoy && p.fechaPago <= limite)
        .filter((p) => !partida || p.partida === partida)
        .sort((a, b) => a.fechaPago.getTime() - b.fechaPago.getTime());

      const total = filtrados.reduce((s, p) => s + toNumber(p.importe), 0);

      return {
        totalFilas: filtrados.length,
        importeTotal: total,
        filas: filtrados.slice(0, MAX_FILAS).map((p) => ({
          fechaPago: p.fechaPago.toISOString().slice(0, 10),
          diasHastaVencimiento: diasDesdeHoy(p.fechaPago),
          observacion: p.observacion,
          proveedor: p.proveedor,
          partida: p.partida,
          situacion: p.situacion,
          importe: toNumber(p.importe),
        })),
      };
    }

    case "cobros_vencidos": {
      const vencidos = ctx.cobros
        .filter((c) => estadoColorCobro(c.fechaVencimiento) === "VENCIDO")
        .sort((a, b) => (a.fechaVencimiento?.getTime() ?? 0) - (b.fechaVencimiento?.getTime() ?? 0));

      const total = vencidos.reduce((s, c) => s + toNumber(c.importeTalon) + toNumber(c.importeTransferencia), 0);

      return {
        totalFilas: vencidos.length,
        importeTotal: total,
        filas: vencidos.slice(0, MAX_FILAS).map((c) => ({
          factura: c.factura,
          fechaVencimiento: c.fechaVencimiento ? c.fechaVencimiento.toISOString().slice(0, 10) : null,
          importe: toNumber(c.importeTalon) + toNumber(c.importeTransferencia),
          observacion: c.observacion,
        })),
      };
    }

    case "proyeccion_mensual": {
      if (!ctx.supuesto) return { error: "Todavía no hay supuestos de proyección configurados en /proyeccion." };
      const meses = typeof input.meses === "number" ? Math.min(Math.max(1, input.meses), 23) : 6;
      const proyeccion = calcularProyeccion(ctx.supuesto, ctx.pagos, ctx.productos).slice(0, meses);
      return proyeccion.map((m) => ({
        mes: m.fecha.toISOString().slice(0, 7),
        cobros: m.cobros,
        pagos: m.pagos,
        flujoNeto: m.flujoNeto,
        saldoSinPoliza: m.saldoSinPoliza,
        saldoConPolizas: m.saldoConPolizas,
        saldoConLineaCaixabank: m.saldoConLineaCaixabank,
        origenDatos: m.origenPagos,
      }));
    }

    default:
      return { error: `Herramienta desconocida: ${nombre}` };
  }
}
