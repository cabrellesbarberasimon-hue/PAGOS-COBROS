import { NextResponse } from "next/server";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { calcularInforme, type InformePosicion } from "@/lib/informe";
import { formatCurrency, formatPct, formatRatio } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#0f172a" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#64748b", marginBottom: 16 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, color: "#1d4ed8" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingVertical: 3 },
  headerRow: { flexDirection: "row", backgroundColor: "#f1f5f9", paddingVertical: 3, fontWeight: 700 },
  cellLabel: { flex: 3 },
  cell: { flex: 1, textAlign: "right" },
  cellWide: { flex: 2, textAlign: "right" },
  note: { fontSize: 8, color: "#94a3b8", marginTop: 4 },
  badgeOk: { color: "#16a34a", fontWeight: 700 },
  badgeBad: { color: "#dc2626", fontWeight: 700 },
});

function Row({ cells, header }: { cells: string[]; header?: boolean }) {
  return (
    <View style={header ? styles.headerRow : styles.row}>
      {cells.map((c, i) => (
        <Text key={i} style={i === 0 ? styles.cellLabel : styles.cell}>
          {c}
        </Text>
      ))}
    </View>
  );
}

function InformePdf({ informe }: { informe: InformePosicion }) {
  const { embudo: e, riesgo: r, capacidadFinanciera: cf, kpis: k } = informe;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Informe de posición — CUBI Mobiliario de Diseño SL</Text>
        <Text style={styles.subtitle}>Generado el {informe.fechaGeneracion.toLocaleString("es-ES")}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Embudo de conversión a caja</Text>
          <Row header cells={["Etapa", "Importe"]} />
          <Row cells={["Pedidos pendientes de servir", formatCurrency(e.pedidosPendientesServir)]} />
          <Row cells={["Albaranes pendientes de facturar", formatCurrency(e.albaranesPendientesFacturar)]} />
          <Row cells={["Facturas pendientes de cobro", formatCurrency(e.facturasPendientesCobro)]} />
          <Row cells={["Efectos pendientes de remesar", formatCurrency(e.efectosPendientesRemesar)]} />
          <Row cells={["Potencial pendiente de convertir", formatCurrency(e.potencialPendienteConvertir)]} />
          <Row cells={["Liquidez ya en caja", formatCurrency(e.liquidezYaEnCaja)]} />
          <Row cells={["TOTAL flujo potencial", formatCurrency(e.totalFlujoPotencial)]} />
          <Text style={styles.note}>% ya convertido en caja: {formatPct(e.pctYaConvertido)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Calidad de la liquidez</Text>
          <Row cells={["Liquidez ajustada por riesgo", formatCurrency(informe.calidadLiquidez.liquidezAjustada)]} />
          <Row cells={["% ajustado sobre el total", formatPct(informe.calidadLiquidez.pctAjustadoSobreTotal)]} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Riesgo de tesorería 30 / 60 / 90 días</Text>
          <Row header cells={["Horizonte", "Pagos pendientes", "Cobertura caja", "Superávit/Déficit"]} />
          <Row cells={["30 días", formatCurrency(r.pagos30), formatRatio(r.coberturaCaja30), formatCurrency(r.superavitDeficit30)]} />
          <Row cells={["60 días", formatCurrency(r.pagos60), "—", formatCurrency(r.liquidezDisponible - r.pagos60)]} />
          <Row cells={["90 días", formatCurrency(r.pagos90), formatRatio(r.coberturaCaja90), formatCurrency(r.superavitDeficit90)]} />
          <Text style={styles.note}>
            Días de pago cubiertos con la caja actual: {r.diasPagoCubiertos ? r.diasPagoCubiertos.toFixed(0) : "—"} días
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Capacidad financiera</Text>
          <Row cells={["Cuota mensual deuda bancaria", formatCurrency(cf.cuotaMensualDeuda)]} />
          <Row cells={["Disponible inmediato (cuenta + pólizas)", formatCurrency(cf.disponibleInmediato)]} />
          <Row cells={["Disponible no dispuesto en pólizas", formatCurrency(cf.disponibleNoDispuestoPolizas)]} />
          <Row cells={["Deuda bancaria corto plazo", formatCurrency(cf.deudaCPBancos)]} />
          <Row cells={["Deuda bancaria largo plazo", formatCurrency(cf.deudaLPBancos)]} />
          <Row cells={[`Colchón de seguridad (${cf.colchonSeguridadMeses} meses)`, formatCurrency(cf.colchonSeguridadEuros)]} />
          <Row cells={["Capacidad de inversión disponible", formatCurrency(cf.capacidadInversion)]} />
          <Row cells={["Capacidad de amortización anticipada", formatCurrency(cf.capacidadAmortizacionAnticipada)]} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. KPIs de gestión</Text>
          <Row cells={["Conversión a caja", formatPct(k.conversionACaja)]} />
          <Row cells={["Facturación pendiente", formatPct(k.facturacionPendientePct)]} />
          <Row cells={["Cobro pendiente", formatPct(k.cobroPendientePct)]} />
          <Row cells={["Cobertura de deuda total", formatPct(k.coberturaDeudaTotalPct)]} />
          <Row cells={["Cobertura deuda corto plazo", formatRatio(k.coberturaDeudaCPBancaPct)]} />
          <Row cells={["Cobertura de pagos a 90 días", formatPct(k.coberturaPagos90Pct)]} />
          <Row cells={["Peso cuota mensual sobre disponible", formatPct(k.pesoCuotaSobreDisponiblePct)]} />
          <Row cells={["Apalancamiento", formatRatio(k.apalancamiento)]} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Panel de alertas automáticas</Text>
          {informe.alertas.map((a) => (
            <View key={a.label} style={styles.row}>
              <Text style={styles.cellLabel}>{a.label}</Text>
              <Text style={styles.cell}>{a.formato === "pct" ? formatPct(a.valor) : formatRatio(a.valor)}</Text>
              <Text style={[styles.cell, a.ok ? styles.badgeOk : styles.badgeBad]}>
                {a.ok === null ? "Sin datos" : a.ok ? "OK" : "Revisar"}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Proyección a 12 meses</Text>
          <Row header cells={["Mes", "Cobros", "Pagos", "Saldo con pólizas"]} />
          {informe.proyeccion12Meses.map((m) => (
            <Row
              key={m.fecha.toISOString()}
              cells={[
                m.fecha.toLocaleDateString("es-ES", { month: "short", year: "numeric" }),
                formatCurrency(m.cobros),
                formatCurrency(m.pagos),
                formatCurrency(m.saldoConPolizas),
              ]}
            />
          ))}
        </View>
      </Page>
    </Document>
  );
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
  const buffer = await renderToBuffer(<InformePdf informe={informe} />);
  const fecha = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="informe-posicion-${fecha}.pdf"`,
    },
  });
}
