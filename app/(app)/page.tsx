import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeDashboardKpis } from "@/lib/kpis";
import { calcularProyeccion } from "@/lib/tesoreria";
import { KpiCard } from "@/components/KpiCard";
import { ProyeccionChart } from "@/components/ProyeccionChart";
import { formatCurrency, formatDate } from "@/lib/format";
import { estadoColorCobro, COLOR_CLASSES } from "@/lib/cobro-color";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [productos, pagos, cobros, supuesto] = await Promise.all([
    prisma.productoFinanciero.findMany(),
    prisma.pago.findMany(),
    prisma.cobro.findMany({ where: { tipo: "NORMAL" } }),
    prisma.supuestoTesoreria.findFirst({ orderBy: { updatedAt: "desc" } }),
  ]);

  const kpis = computeDashboardKpis(productos, pagos, cobros);

  const proyeccion = supuesto ? calcularProyeccion(supuesto, pagos, productos) : [];

  const proximosPagos = pagos
    .filter((p) => p.estado === "PENDIENTE")
    .sort((a, b) => a.fechaPago.getTime() - b.fechaPago.getTime())
    .slice(0, 8);

  const cobrosUrgentes = cobros
    .map((c) => ({ cobro: c, estado: estadoColorCobro(c.fechaVencimiento) }))
    .filter((x) => x.estado === "VENCIDO" || x.estado === "PROXIMO")
    .sort((a, b) => (a.cobro.fechaVencimiento?.getTime() ?? 0) - (b.cobro.fechaVencimiento?.getTime() ?? 0))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Posición de tesorería de CUBI Mobiliario de Diseño SL</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Liquidez disponible" value={formatCurrency(kpis.liquidezDisponible)} tone="success" />
        <KpiCard label="Deuda total bancos" value={formatCurrency(kpis.deudaTotalBancos)} tone="danger" />
        <KpiCard label="Disponible en pólizas" value={formatCurrency(kpis.disponibleEnPolizas)} />
        <KpiCard label="Vencen en 7 días" value={formatCurrency(kpis.vencimientos7)} tone="warning" />
        <KpiCard label="Vencen en 15 días" value={formatCurrency(kpis.vencimientos15)} tone="warning" />
        <KpiCard
          label="Cobros vencidos"
          value={formatCurrency(kpis.cobrosVencidos)}
          tone="danger"
          sub={`${kpis.cobrosVencidosCount} factura(s)`}
        />
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Proyección de tesorería ({supuesto?.mesesProyeccion ?? 23} meses)
          </h2>
          <Link href="/proyeccion" className="text-xs font-medium text-brand-600 hover:underline">
            Ver / editar supuestos →
          </Link>
        </div>
        {supuesto ? (
          <ProyeccionChart
            datos={proyeccion.map((m) => ({
              fecha: m.fecha.toISOString(),
              saldoSinPoliza: m.saldoSinPoliza,
              saldoConPolizas: m.saldoConPolizas,
              saldoConLineaCaixabank: m.saldoConLineaCaixabank,
            }))}
          />
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">
            Todavía no hay supuestos de proyección configurados.{" "}
            <Link href="/proyeccion" className="text-brand-600 hover:underline">
              Configúralos aquí.
            </Link>
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Próximos pagos pendientes</h2>
            <Link href="/pagos" className="text-xs font-medium text-brand-600 hover:underline">
              Ver todos →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {proximosPagos.length === 0 && <li className="py-3 text-sm text-slate-400">Sin pagos pendientes.</li>}
            {proximosPagos.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-slate-800">{p.observacion}</p>
                  <p className="text-xs text-slate-400">{formatDate(p.fechaPago)}</p>
                </div>
                <span className="ml-3 shrink-0 font-medium tabular-nums text-slate-700">
                  {formatCurrency(p.importe)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Cobros vencidos / próximos</h2>
            <Link href="/cobros" className="text-xs font-medium text-brand-600 hover:underline">
              Ver todos →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {cobrosUrgentes.length === 0 && <li className="py-3 text-sm text-slate-400">Sin cobros urgentes.</li>}
            {cobrosUrgentes.map(({ cobro, estado }) => {
              const colors = COLOR_CLASSES[estado];
              return (
                <li key={cobro.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-slate-800">{cobro.factura}</p>
                    <p className="text-xs text-slate-400">{formatDate(cobro.fechaVencimiento)}</p>
                  </div>
                  <span className={`badge ${colors.bg} ${colors.text}`}>{colors.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
