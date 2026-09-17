import { prisma } from "@/lib/prisma";
import { resumenPorPartida, resumenPorProveedor, detectarDuplicados } from "@/lib/tesoreria";
import { partidaLabel } from "@/lib/partidas";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ResumenPage() {
  const pagos = await prisma.pago.findMany();

  const porPartida = resumenPorPartida(pagos);
  const porProveedor = resumenPorProveedor(pagos);
  const duplicados = detectarDuplicados(pagos);

  const totalGeneral = pagos.reduce((s, p) => s + Number(p.importe), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Resumen de pagos</h1>
        <p className="text-sm text-slate-500">
          {pagos.length} pagos · {formatCurrency(totalGeneral)} en total
        </p>
      </div>

      {duplicados.length > 0 && (
        <div className="card border-semaforo-ambar bg-semaforo-ambarBg">
          <h2 className="text-sm font-semibold text-semaforo-ambar">
            ⚠ Posibles duplicados detectados ({duplicados.length})
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Misma observación y misma fecha de pago. Revísalos en la pantalla de Pagos.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {duplicados.slice(0, 10).map((grupo, i) => (
              <li key={i}>
                {grupo[0].observacion} — {formatDate(grupo[0].fechaPago)} ({grupo.length}×)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card overflow-x-auto p-0">
          <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900">Por proveedor</h2>
          <table className="table-base mt-2">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th className="text-right">Nº</th>
                <th className="text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {porProveedor.map((r) => (
                <tr key={r.proveedor}>
                  <td className="max-w-xs truncate">{r.proveedor}</td>
                  <td className="text-right tabular-nums">{r.nCount}</td>
                  <td className="text-right tabular-nums font-medium">{formatCurrency(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card overflow-x-auto p-0">
          <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900">Por partida</h2>
          <table className="table-base mt-2">
            <thead>
              <tr>
                <th>Partida</th>
                <th className="text-right">Nº</th>
                <th className="text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {porPartida.map((r) => (
                <tr key={r.partida}>
                  <td>{partidaLabel(r.partida)}</td>
                  <td className="text-right tabular-nums">{r.nCount}</td>
                  <td className="text-right tabular-nums font-medium">{formatCurrency(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
