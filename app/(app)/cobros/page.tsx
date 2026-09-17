import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { estadoColorCobro, COLOR_CLASSES } from "@/lib/cobro-color";
import { deleteCobro } from "@/lib/actions/cobros";

export const dynamic = "force-dynamic";

export default async function CobrosPage() {
  const [normales, incidencias] = await Promise.all([
    prisma.cobro.findMany({ where: { tipo: "NORMAL" }, orderBy: { fechaVencimiento: "asc" } }),
    prisma.cobro.findMany({ where: { tipo: "INCIDENCIA_DEVOLUCION" }, orderBy: { fechaVencimiento: "asc" } }),
  ]);

  const totalNormales = normales.reduce(
    (s, c) => s + Number(c.importeTalon ?? 0) + Number(c.importeTransferencia ?? 0),
    0
  );
  const totalIncidencias = incidencias.reduce(
    (s, c) => s + Number(c.importeIncidencia ?? 0) + Number(c.importeDevolucion ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cobros</h1>
          <p className="text-sm text-slate-500">Control de cobros por talón/transferencia y paralizados</p>
        </div>
        <div className="flex gap-2">
          <Link href="/importar" className="btn-secondary">
            Importar Excel/CSV
          </Link>
          <Link href="/cobros/nuevo" className="btn-primary">
            + Nuevo cobro
          </Link>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-sm font-semibold text-slate-900">Control de cobros: trf, talones y paralizado</h2>
          <span className="text-sm font-medium tabular-nums">{formatCurrency(totalNormales)}</span>
        </div>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Fecha fra.</th>
              <th>Vencimiento</th>
              <th>Factura</th>
              <th className="text-right">Talón</th>
              <th className="text-right">Transf.</th>
              <th>Observación</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {normales.map((c) => {
              const estado = estadoColorCobro(c.fechaVencimiento);
              const colors = COLOR_CLASSES[estado];
              return (
                <tr key={c.id} className={colors.bg}>
                  <td className="whitespace-nowrap">{formatDate(c.fechaFactura)}</td>
                  <td className="whitespace-nowrap">{formatDate(c.fechaVencimiento)}</td>
                  <td className="max-w-xs truncate">{c.factura}</td>
                  <td className="text-right tabular-nums">{c.importeTalon ? formatCurrency(c.importeTalon) : "—"}</td>
                  <td className="text-right tabular-nums">
                    {c.importeTransferencia ? formatCurrency(c.importeTransferencia) : "—"}
                  </td>
                  <td className="max-w-[12rem] truncate text-xs text-slate-500">{c.observacion}</td>
                  <td>
                    <span className={`badge ${colors.text} bg-white/60`}>{colors.label}</span>
                  </td>
                  <td className="whitespace-nowrap text-right text-xs">
                    <Link href={`/cobros/${c.id}/editar`} className="mr-2 text-brand-600 hover:underline">
                      Editar
                    </Link>
                    <form action={deleteCobro} className="inline">
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="text-semaforo-rojo hover:underline">
                        Borrar
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {normales.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-slate-400">
                  Sin cobros normales registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-sm font-semibold text-slate-900">Incidencias y devoluciones</h2>
          <span className="text-sm font-medium tabular-nums">{formatCurrency(totalIncidencias)}</span>
        </div>
        <table className="table-base mt-2">
          <thead>
            <tr>
              <th>Fecha fra.</th>
              <th>Vencimiento</th>
              <th>Factura</th>
              <th className="text-right">Incidencia</th>
              <th className="text-right">Devolución</th>
              <th>Observación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {incidencias.map((c) => (
              <tr key={c.id}>
                <td className="whitespace-nowrap">{formatDate(c.fechaFactura)}</td>
                <td className="whitespace-nowrap">{formatDate(c.fechaVencimiento)}</td>
                <td className="max-w-xs truncate">{c.factura}</td>
                <td className="text-right tabular-nums">
                  {c.importeIncidencia ? formatCurrency(c.importeIncidencia) : "—"}
                </td>
                <td className="text-right tabular-nums">
                  {c.importeDevolucion ? formatCurrency(c.importeDevolucion) : "—"}
                </td>
                <td className="max-w-[16rem] truncate text-xs text-slate-500">{c.observacion}</td>
                <td className="whitespace-nowrap text-right text-xs">
                  <Link href={`/cobros/${c.id}/editar`} className="mr-2 text-brand-600 hover:underline">
                    Editar
                  </Link>
                  <form action={deleteCobro} className="inline">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="text-semaforo-rojo hover:underline">
                      Borrar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {incidencias.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                  Sin incidencias registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
