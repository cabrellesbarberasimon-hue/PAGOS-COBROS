import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { asignarRemesa, posponerUnaSemana } from "@/lib/actions/pagos";

export const dynamic = "force-dynamic";

function lunesDe(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0 = domingo
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function RemesasPage() {
  const pagos = await prisma.pago.findMany({
    where: { situacion: "TRANSFERENCIA", estado: "PENDIENTE" },
    orderBy: { fechaPago: "asc" },
  });

  const sinAsignar = pagos.filter((p) => !p.remesaSemana);
  const asignados = pagos.filter((p) => p.remesaSemana);

  const grupos = new Map<string, typeof asignados>();
  for (const p of asignados) {
    const key = p.remesaSemana!.toISOString();
    const arr = grupos.get(key) ?? [];
    arr.push(p);
    grupos.set(key, arr);
  }
  const semanasOrdenadas = Array.from(grupos.keys()).sort();

  const lunesActual = toInputDate(lunesDe(new Date()));
  const lunesProxima = toInputDate(new Date(new Date(lunesActual).getTime() + 7 * 86400000));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Remesas semanales de transferencias</h1>
        <p className="text-sm text-slate-500">
          Selecciona qué transferencias pendientes entran en la remesa de cada semana, o retrásalas si toca.
        </p>
      </div>

      {semanasOrdenadas.map((key) => {
        const items = grupos.get(key)!;
        const total = items.reduce((s, p) => s + Number(p.importe), 0);
        return (
          <div key={key} className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Semana del {formatDate(new Date(key))} · {items.length} pago(s)
              </h2>
              <span className="text-sm font-medium tabular-nums text-slate-700">{formatCurrency(total)}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-800">{p.observacion}</p>
                    <p className="text-xs text-slate-400">Fecha pago prevista: {formatDate(p.fechaPago)}</p>
                  </div>
                  <span className="font-medium tabular-nums">{formatCurrency(p.importe)}</span>
                  <div className="flex gap-2">
                    <form action={posponerUnaSemana}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="semanaActual" value={key} />
                      <button type="submit" className="btn-secondary !px-2 !py-1 text-xs">
                        Retrasar 1 semana
                      </button>
                    </form>
                    <form action={asignarRemesa}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="semana" value="" />
                      <button type="submit" className="text-xs text-slate-400 hover:underline">
                        Quitar
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Sin asignar a ninguna remesa ({sinAsignar.length})
        </h2>
        <ul className="divide-y divide-slate-100">
          {sinAsignar.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-slate-800">{p.observacion}</p>
                <p className="text-xs text-slate-400">Fecha pago prevista: {formatDate(p.fechaPago)}</p>
              </div>
              <span className="font-medium tabular-nums">{formatCurrency(p.importe)}</span>
              <div className="flex gap-2">
                <form action={asignarRemesa}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="semana" value={lunesActual} />
                  <button type="submit" className="btn-secondary !px-2 !py-1 text-xs">
                    A esta semana
                  </button>
                </form>
                <form action={asignarRemesa}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="semana" value={lunesProxima} />
                  <button type="submit" className="btn-secondary !px-2 !py-1 text-xs">
                    A la próxima
                  </button>
                </form>
              </div>
            </li>
          ))}
          {sinAsignar.length === 0 && <li className="py-3 text-sm text-slate-400">Todo asignado.</li>}
        </ul>
      </div>
    </div>
  );
}
