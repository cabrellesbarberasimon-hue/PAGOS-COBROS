import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { partidaLabel } from "@/lib/partidas";
import { deletePago, togglePagado } from "@/lib/actions/pagos";
import { Partida, Prisma, SituacionPago, EstadoPago } from "@prisma/client";

export const dynamic = "force-dynamic";

interface Filtros {
  proveedor?: string;
  situacion?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
}

export default async function PagosPage({ searchParams }: { searchParams: Filtros }) {
  const where: Prisma.PagoWhereInput = {};

  if (searchParams.proveedor) {
    where.OR = [
      { proveedor: { contains: searchParams.proveedor, mode: "insensitive" } },
      { observacion: { contains: searchParams.proveedor, mode: "insensitive" } },
    ];
  }
  if (searchParams.situacion) where.situacion = searchParams.situacion as SituacionPago;
  if (searchParams.estado) where.estado = searchParams.estado as EstadoPago;
  if (searchParams.desde || searchParams.hasta) {
    where.fechaPago = {};
    if (searchParams.desde) where.fechaPago.gte = new Date(searchParams.desde);
    if (searchParams.hasta) where.fechaPago.lte = new Date(searchParams.hasta);
  }

  const pagos = await prisma.pago.findMany({ where, orderBy: { fechaPago: "asc" } });
  const total = pagos.reduce((s, p) => s + Number(p.importe), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Pagos</h1>
          <p className="text-sm text-slate-500">
            {pagos.length} pagos · {formatCurrency(total)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/pagos/remesas" className="btn-secondary">
            Remesas semanales de trf
          </Link>
          <Link href="/importar" className="btn-secondary">
            Importar Excel/CSV
          </Link>
          <Link href="/pagos/nuevo" className="btn-primary">
            + Nuevo pago
          </Link>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-3" method="GET">
        <div>
          <label className="label">Proveedor / texto</label>
          <input name="proveedor" defaultValue={searchParams.proveedor} className="input" placeholder="Buscar..." />
        </div>
        <div>
          <label className="label">Situación</label>
          <select name="situacion" defaultValue={searchParams.situacion ?? ""} className="input">
            <option value="">Todas</option>
            <option value="GIRO">Giro</option>
            <option value="TRANSFERENCIA">Transferencia</option>
          </select>
        </div>
        <div>
          <label className="label">Estado</label>
          <select name="estado" defaultValue={searchParams.estado ?? ""} className="input">
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PAGADO">Pagado</option>
          </select>
        </div>
        <div>
          <label className="label">Desde</label>
          <input type="date" name="desde" defaultValue={searchParams.desde} className="input" />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input type="date" name="hasta" defaultValue={searchParams.hasta} className="input" />
        </div>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
        <Link href="/pagos" className="text-xs text-slate-400 hover:underline">
          Limpiar
        </Link>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>Fecha pago</th>
              <th>Situación</th>
              <th>Observación</th>
              <th>Proveedor</th>
              <th>Partida</th>
              <th className="text-right">Importe</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap">{formatDate(p.fechaPago)}</td>
                <td>
                  <span
                    className={`badge ${
                      p.situacion === "GIRO" ? "bg-slate-100 text-slate-600" : "bg-brand-50 text-brand-700"
                    }`}
                  >
                    {p.situacion === "GIRO" ? "Giro" : "Trf"}
                  </span>
                </td>
                <td className="max-w-xs truncate" title={p.observacion}>
                  {p.observacion}
                </td>
                <td className="max-w-[10rem] truncate">{p.proveedor ?? "—"}</td>
                <td className="whitespace-nowrap text-xs text-slate-500">{partidaLabel(p.partida as Partida)}</td>
                <td className="text-right font-medium tabular-nums">{formatCurrency(p.importe)}</td>
                <td>
                  <form action={togglePagado}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="estadoActual" value={p.estado} />
                    <button
                      type="submit"
                      className={`badge ${
                        p.estado === "PAGADO"
                          ? "bg-semaforo-verdeBg text-semaforo-verde"
                          : "bg-semaforo-ambarBg text-semaforo-ambar"
                      }`}
                    >
                      {p.estado === "PAGADO" ? "Pagado" : "Pendiente"}
                    </button>
                  </form>
                </td>
                <td className="whitespace-nowrap text-right text-xs">
                  <Link href={`/pagos/${p.id}/editar`} className="mr-2 text-brand-600 hover:underline">
                    Editar
                  </Link>
                  <form action={deletePago} className="inline">
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="text-semaforo-rojo hover:underline">
                      Borrar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {pagos.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-slate-400">
                  No hay pagos con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
