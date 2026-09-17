import { prisma } from "@/lib/prisma";
import { calcularProyeccion } from "@/lib/tesoreria";
import { formatCurrency, formatDate } from "@/lib/format";
import { ProyeccionChart } from "@/components/ProyeccionChart";
import { updateSupuesto } from "@/lib/actions/supuesto";

export const dynamic = "force-dynamic";

function toInputDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export default async function ProyeccionPage() {
  const [supuesto, pagos, productos] = await Promise.all([
    prisma.supuestoTesoreria.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.pago.findMany(),
    prisma.productoFinanciero.findMany(),
  ]);

  const proyeccion = supuesto ? calcularProyeccion(supuesto, pagos, productos) : [];

  const s = supuesto ?? {
    id: "",
    facturacionMensual: 0,
    desfaseCobroMeses: 1,
    pagosProveedoresMes: 0,
    gastosFijosMes: 0,
    saldoInicialCuentas: 0,
    saldoInicialCuentasPolizas: 0,
    lineaFinanciacionCaixabank: 0,
    letrasEnCartera: 0,
    pctLetrasCobradasPrimerMes: 1,
    albaranesGirosACobrar: 0,
    seguroNavePrimaAnual: 0,
    pagoMod111Trimestre: 0,
    previsionMensual: 0,
    fechaInicioProyeccion: new Date(),
    mesesProyeccion: 23,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Proyección de tesorería</h1>
        <p className="text-sm text-slate-500">
          Supuestos editables + {s.mesesProyeccion} meses recalculados en vivo. Los pagos ya registrados en la app
          se usan directamente en los meses que cubren; el resto se estima con los supuestos.
        </p>
      </div>

      <form action={updateSupuesto} className="card grid gap-4 md:grid-cols-3">
        <input type="hidden" name="id" value={s.id} />

        <div>
          <label className="label">Facturación mensual (€)</label>
          <input name="facturacionMensual" defaultValue={s.facturacionMensual.toString()} className="input w-full" />
        </div>
        <div>
          <label className="label">Desfase de cobro (meses)</label>
          <input name="desfaseCobroMeses" defaultValue={s.desfaseCobroMeses.toString()} className="input w-full" />
        </div>
        <div>
          <label className="label">Pagos a proveedores / mes (€)</label>
          <input name="pagosProveedoresMes" defaultValue={s.pagosProveedoresMes.toString()} className="input w-full" />
        </div>

        <div>
          <label className="label">Gastos fijos estructura / mes (€)</label>
          <input name="gastosFijosMes" defaultValue={s.gastosFijosMes.toString()} className="input w-full" />
        </div>
        <div>
          <label className="label">Saldo inicial cuentas (€)</label>
          <input name="saldoInicialCuentas" defaultValue={s.saldoInicialCuentas.toString()} className="input w-full" />
        </div>
        <div>
          <label className="label">Saldo inicial cuentas + pólizas (€)</label>
          <input
            name="saldoInicialCuentasPolizas"
            defaultValue={s.saldoInicialCuentasPolizas.toString()}
            className="input w-full"
          />
        </div>

        <div>
          <label className="label">Línea financiación CaixaBank (€)</label>
          <input
            name="lineaFinanciacionCaixabank"
            defaultValue={s.lineaFinanciacionCaixabank.toString()}
            className="input w-full"
          />
        </div>
        <div>
          <label className="label">Letras en cartera (€)</label>
          <input name="letrasEnCartera" defaultValue={s.letrasEnCartera.toString()} className="input w-full" />
        </div>
        <div>
          <label className="label">% letras cobradas 1er mes</label>
          <input
            name="pctLetrasCobradasPrimerMesPct"
            defaultValue={(Number(s.pctLetrasCobradasPrimerMes) * 100).toString()}
            className="input w-full"
          />
        </div>

        <div>
          <label className="label">Albaranes/giros a cobrar (€)</label>
          <input
            name="albaranesGirosACobrar"
            defaultValue={s.albaranesGirosACobrar.toString()}
            className="input w-full"
          />
        </div>
        <div>
          <label className="label">Seguro nave, prima anual (€)</label>
          <input name="seguroNavePrimaAnual" defaultValue={s.seguroNavePrimaAnual.toString()} className="input w-full" />
        </div>
        <div>
          <label className="label">Pago Mod 111 / trimestre (€)</label>
          <input name="pagoMod111Trimestre" defaultValue={s.pagoMod111Trimestre.toString()} className="input w-full" />
        </div>

        <div>
          <label className="label">Previsión mensual (€)</label>
          <input name="previsionMensual" defaultValue={s.previsionMensual.toString()} className="input w-full" />
        </div>
        <div>
          <label className="label">Fecha de inicio</label>
          <input
            type="date"
            name="fechaInicioProyeccion"
            defaultValue={toInputDate(s.fechaInicioProyeccion)}
            className="input w-full"
          />
        </div>
        <div>
          <label className="label">Meses a proyectar</label>
          <input name="mesesProyeccion" defaultValue={s.mesesProyeccion.toString()} className="input w-full" />
        </div>

        <div className="md:col-span-3">
          <button type="submit" className="btn-primary">
            Guardar y recalcular
          </button>
        </div>
      </form>

      {supuesto && (
        <>
          <div className="card">
            <ProyeccionChart
              datos={proyeccion.map((m) => ({
                fecha: m.fecha.toISOString(),
                saldoSinPoliza: m.saldoSinPoliza,
                saldoConPolizas: m.saldoConPolizas,
                saldoConLineaCaixabank: m.saldoConLineaCaixabank,
              }))}
            />
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="text-right">Cobros</th>
                  <th className="text-right">Pagos</th>
                  <th>Origen pagos</th>
                  <th className="text-right">Flujo neto</th>
                  <th className="text-right">Saldo sin póliza</th>
                  <th className="text-right">Saldo con pólizas</th>
                  <th className="text-right">Saldo + línea CaixaBank</th>
                </tr>
              </thead>
              <tbody>
                {proyeccion.map((m) => (
                  <tr key={m.fecha.toISOString()}>
                    <td className="whitespace-nowrap">{formatDate(m.fecha)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(m.cobros)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(m.pagos)}</td>
                    <td>
                      <span
                        className={`badge ${
                          m.origenPagos === "real"
                            ? "bg-semaforo-verdeBg text-semaforo-verde"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {m.origenPagos === "real" ? "Datos reales" : "Estimado"}
                      </span>
                    </td>
                    <td
                      className={`text-right tabular-nums font-medium ${
                        m.flujoNeto < 0 ? "text-semaforo-rojo" : "text-semaforo-verde"
                      }`}
                    >
                      {formatCurrency(m.flujoNeto)}
                    </td>
                    <td className="text-right tabular-nums">{formatCurrency(m.saldoSinPoliza)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(m.saldoConPolizas)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(m.saldoConLineaCaixabank)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
