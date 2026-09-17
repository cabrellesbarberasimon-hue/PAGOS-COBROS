import { prisma } from "@/lib/prisma";
import { calcularInforme } from "@/lib/informe";
import { formatCurrency, formatDate, formatPct, formatRatio } from "@/lib/format";
import { updateInformeInputs } from "@/lib/actions/supuesto";
import { ProyeccionChart } from "@/components/ProyeccionChart";

export const dynamic = "force-dynamic";

function AlertaBadge({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="badge bg-slate-100 text-slate-500">Sin datos</span>;
  return ok ? (
    <span className="badge bg-semaforo-verdeBg text-semaforo-verde">✔ OK</span>
  ) : (
    <span className="badge bg-semaforo-rojoBg text-semaforo-rojo">⚠ Revisar</span>
  );
}

export default async function InformePage() {
  const [supuesto, pagos, cobros, productos] = await Promise.all([
    prisma.supuestoTesoreria.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.pago.findMany(),
    prisma.cobro.findMany(),
    prisma.productoFinanciero.findMany(),
  ]);

  if (!supuesto) {
    return (
      <div className="card text-sm text-slate-500">
        Configura primero los supuestos en{" "}
        <a href="/proyeccion" className="text-brand-600 hover:underline">
          Proyección de tesorería
        </a>{" "}
        para poder generar el informe.
      </div>
    );
  }

  const informe = calcularInforme(supuesto, pagos, cobros, productos);
  const e = informe.embudo;
  const r = informe.riesgo;
  const cf = informe.capacidadFinanciera;
  const k = informe.kpis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Informe de posición</h1>
          <p className="text-sm text-slate-500">Generado a día de hoy, {formatDate(informe.fechaGeneracion)}</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/informe/excel" className="btn-secondary">
            ⬇ Exportar Excel
          </a>
          <a href="/api/informe/pdf" className="btn-secondary">
            ⬇ Exportar PDF
          </a>
        </div>
      </div>

      {/* 1. Embudo de conversión a caja */}
      <div className="card overflow-x-auto p-0">
        <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900">1 · Embudo de conversión a caja</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Etapa</th>
              <th className="text-right">Importe</th>
              <th className="text-right">% del flujo total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Pedidos pendientes de servir</td>
              <td className="text-right tabular-nums">{formatCurrency(e.pedidosPendientesServir)}</td>
              <td className="text-right tabular-nums">
                {formatPct(e.totalFlujoPotencial > 0 ? e.pedidosPendientesServir / e.totalFlujoPotencial : null)}
              </td>
            </tr>
            <tr>
              <td>Albaranes pendientes de facturar</td>
              <td className="text-right tabular-nums">{formatCurrency(e.albaranesPendientesFacturar)}</td>
              <td className="text-right tabular-nums">
                {formatPct(e.totalFlujoPotencial > 0 ? e.albaranesPendientesFacturar / e.totalFlujoPotencial : null)}
              </td>
            </tr>
            <tr>
              <td>Facturas pendientes de cobro</td>
              <td className="text-right tabular-nums">{formatCurrency(e.facturasPendientesCobro)}</td>
              <td className="text-right tabular-nums">
                {formatPct(e.totalFlujoPotencial > 0 ? e.facturasPendientesCobro / e.totalFlujoPotencial : null)}
              </td>
            </tr>
            <tr>
              <td>Efectos pendientes de remesar</td>
              <td className="text-right tabular-nums">{formatCurrency(e.efectosPendientesRemesar)}</td>
              <td className="text-right tabular-nums">
                {formatPct(e.totalFlujoPotencial > 0 ? e.efectosPendientesRemesar / e.totalFlujoPotencial : null)}
              </td>
            </tr>
            <tr className="font-medium">
              <td>Potencial pendiente de convertir</td>
              <td className="text-right tabular-nums">{formatCurrency(e.potencialPendienteConvertir)}</td>
              <td className="text-right tabular-nums">
                {formatPct(e.totalFlujoPotencial > 0 ? e.potencialPendienteConvertir / e.totalFlujoPotencial : null)}
              </td>
            </tr>
            <tr>
              <td>Liquidez ya en caja (realizado)</td>
              <td className="text-right tabular-nums">{formatCurrency(e.liquidezYaEnCaja)}</td>
              <td className="text-right tabular-nums">{formatPct(e.pctYaConvertido)}</td>
            </tr>
            <tr className="font-semibold">
              <td>TOTAL flujo potencial (pipeline + caja)</td>
              <td className="text-right tabular-nums">{formatCurrency(e.totalFlujoPotencial)}</td>
              <td className="text-right tabular-nums">100%</td>
            </tr>
          </tbody>
        </table>
        <p className="px-4 pb-4 pt-2 text-xs text-slate-400">
          % ya convertido en caja: <strong>{formatPct(e.pctYaConvertido)}</strong>
        </p>
      </div>

      {/* 2. Calidad de liquidez */}
      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">2 · Calidad de la liquidez (certeza de cobro)</h2>
        <p className="text-sm text-slate-600">
          Liquidez ajustada por riesgo (ponderando cada etapa del embudo por su cobrabilidad estimada):{" "}
          <strong>{formatCurrency(informe.calidadLiquidez.liquidezAjustada)}</strong> (
          {formatPct(informe.calidadLiquidez.pctAjustadoSobreTotal)} del flujo potencial total)
        </p>
      </div>

      {/* 3. Riesgo 30/60/90 */}
      <div className="card overflow-x-auto p-0">
        <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900">3 · Riesgo de tesorería 30 / 60 / 90 días</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Horizonte</th>
              <th className="text-right">Pagos pendientes</th>
              <th className="text-right">Cobertura caja</th>
              <th className="text-right">Cobertura caja+efectos</th>
              <th className="text-right">Superávit/Déficit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>30 días</td>
              <td className="text-right tabular-nums">{formatCurrency(r.pagos30)}</td>
              <td className="text-right tabular-nums">{formatRatio(r.coberturaCaja30)}</td>
              <td className="text-right tabular-nums">{formatRatio(r.coberturaCajaEfectos30)}</td>
              <td
                className={`text-right tabular-nums font-medium ${
                  r.superavitDeficit30 < 0 ? "text-semaforo-rojo" : "text-semaforo-verde"
                }`}
              >
                {formatCurrency(r.superavitDeficit30)}
              </td>
            </tr>
            <tr>
              <td>60 días</td>
              <td className="text-right tabular-nums">{formatCurrency(r.pagos60)}</td>
              <td className="text-right tabular-nums" colSpan={2}>
                —
              </td>
              <td className="text-right tabular-nums font-medium">
                {formatCurrency(r.liquidezDisponible - r.pagos60)}
              </td>
            </tr>
            <tr>
              <td>90 días</td>
              <td className="text-right tabular-nums">{formatCurrency(r.pagos90)}</td>
              <td className="text-right tabular-nums">{formatRatio(r.coberturaCaja90)}</td>
              <td className="text-right tabular-nums">—</td>
              <td
                className={`text-right tabular-nums font-medium ${
                  r.superavitDeficit90 < 0 ? "text-semaforo-rojo" : "text-semaforo-verde"
                }`}
              >
                {formatCurrency(r.superavitDeficit90)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="px-4 pb-4 pt-2 text-xs text-slate-400">
          Días de pago cubiertos con la caja actual:{" "}
          <strong>{r.diasPagoCubiertos ? r.diasPagoCubiertos.toFixed(0) : "—"} días</strong>
        </p>
      </div>

      {/* 4. Capacidad financiera + inputs manuales */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">4 · Capacidad financiera</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Cuota mensual deuda bancaria</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(cf.cuotaMensualDeuda)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Disponible inmediato (cuenta + pólizas)</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(cf.disponibleInmediato)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Disponible no dispuesto en pólizas</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(cf.disponibleNoDispuestoPolizas)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Deuda bancaria corto plazo (partida Bancos)</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(cf.deudaCPBancos)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Deuda bancaria largo plazo (resto)</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(cf.deudaLPBancos)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Colchón de seguridad ({cf.colchonSeguridadMeses} meses de cuota)</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(cf.colchonSeguridadEuros)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Meses de cuota cubiertos con disponible</dt>
              <dd className="font-medium tabular-nums">
                {cf.mesesCuotaCubiertos ? cf.mesesCuotaCubiertos.toFixed(1) : "—"}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <dt className="font-medium text-slate-700">Capacidad de inversión disponible</dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(cf.capacidadInversion)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-medium text-slate-700">Capacidad de amortización anticipada</dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(cf.capacidadAmortizacionAnticipada)}</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Insumos manuales del informe</h2>
          <p className="mb-3 text-xs text-slate-400">
            Estos 3 datos no se pueden calcular a partir de Pagos/Cobros (son a nivel de pedido/proyecto): actualízalos
            cuando cambien.
          </p>
          <form action={updateInformeInputs} className="space-y-3">
            <input type="hidden" name="id" value={supuesto.id} />
            <div>
              <label className="label">Pedidos pendientes de servir (€)</label>
              <input
                name="pedidosPendientesServir"
                defaultValue={supuesto.pedidosPendientesServir.toString()}
                className="input w-full"
              />
            </div>
            <div>
              <label className="label">Inversiones pendientes (€)</label>
              <input
                name="inversionesPendientes"
                defaultValue={supuesto.inversionesPendientes.toString()}
                className="input w-full"
              />
            </div>
            <div>
              <label className="label">Colchón de seguridad (meses de cuota)</label>
              <input
                name="colchonSeguridadMeses"
                defaultValue={supuesto.colchonSeguridadMeses.toString()}
                className="input w-full"
              />
            </div>
            <button type="submit" className="btn-primary">
              Guardar y recalcular
            </button>
          </form>
        </div>
      </div>

      {/* 5. KPIs de gestión */}
      <div className="card overflow-x-auto p-0">
        <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900">5 · KPIs de gestión</h2>
        <table className="table-base mt-2">
          <tbody>
            <tr>
              <td>Conversión a caja</td>
              <td className="text-right tabular-nums">{formatPct(k.conversionACaja)}</td>
              <td className="text-xs text-slate-400">% del flujo potencial ya en caja</td>
            </tr>
            <tr>
              <td>Facturación pendiente</td>
              <td className="text-right tabular-nums">{formatPct(k.facturacionPendientePct)}</td>
              <td className="text-xs text-slate-400">Albaranes sin facturar / comercial pendiente</td>
            </tr>
            <tr>
              <td>Cobro pendiente</td>
              <td className="text-right tabular-nums">{formatPct(k.cobroPendientePct)}</td>
              <td className="text-xs text-slate-400">Facturas sin cobrar / facturado por cobrar</td>
            </tr>
            <tr>
              <td>Cobertura de deuda total</td>
              <td className="text-right tabular-nums">{formatPct(k.coberturaDeudaTotalPct)}</td>
              <td className="text-xs text-slate-400">Liquidez ajustada / deuda bancaria restante</td>
            </tr>
            <tr>
              <td>Cobertura deuda corto plazo</td>
              <td className="text-right tabular-nums">{formatRatio(k.coberturaDeudaCPBancaPct)}</td>
              <td className="text-xs text-slate-400">Disponible / deuda bancaria a corto plazo</td>
            </tr>
            <tr>
              <td>Cobertura de pagos a 90 días</td>
              <td className="text-right tabular-nums">{formatPct(k.coberturaPagos90Pct)}</td>
              <td className="text-xs text-slate-400">Caja actual / pagos a 90 días</td>
            </tr>
            <tr>
              <td>Peso cuota mensual sobre disponible</td>
              <td className="text-right tabular-nums">{formatPct(k.pesoCuotaSobreDisponiblePct)}</td>
              <td className="text-xs text-slate-400">Cuota mensual / disponible inmediato</td>
            </tr>
            <tr>
              <td>Apalancamiento (deuda / disponible)</td>
              <td className="text-right tabular-nums">{formatRatio(k.apalancamiento)}</td>
              <td className="text-xs text-slate-400">Deuda bancaria restante / disponible</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 6. Alertas */}
      <div className="card overflow-x-auto p-0">
        <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900">6 · Panel de alertas automáticas</h2>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Alerta</th>
              <th className="text-right">Valor</th>
              <th>Umbral</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {informe.alertas.map((a) => (
              <tr key={a.label}>
                <td className="max-w-xs">
                  {a.label}
                  <p className="text-xs text-slate-400">{a.detalle}</p>
                </td>
                <td className="text-right tabular-nums">
                  {a.formato === "pct" ? formatPct(a.valor) : formatRatio(a.valor)}
                </td>
                <td className="text-xs text-slate-500">
                  {a.formato === "pct" ? formatPct(a.umbral) : formatRatio(a.umbral)}
                </td>
                <td>
                  <AlertaBadge ok={a.ok} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 7. Proyección 12 meses */}
      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">7 · Proyección a 12 meses</h2>
        <ProyeccionChart
          datos={informe.proyeccion12Meses.map((m) => ({
            fecha: m.fecha.toISOString(),
            saldoSinPoliza: m.saldoSinPoliza,
            saldoConPolizas: m.saldoConPolizas,
            saldoConLineaCaixabank: m.saldoConLineaCaixabank,
          }))}
        />
        <p className="mt-2 text-xs text-slate-400">
          Mismos datos que la pantalla{" "}
          <a href="/proyeccion" className="text-brand-600 hover:underline">
            Proyección de tesorería
          </a>
          , recortados a los primeros 12 meses.
        </p>
      </div>
    </div>
  );
}
