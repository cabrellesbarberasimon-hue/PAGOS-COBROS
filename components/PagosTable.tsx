"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/format";
import { partidaLabel } from "@/lib/partidas";
import { deletePago, togglePagado, asignarRemesaMultiple } from "@/lib/actions/pagos";
import { Partida } from "@prisma/client";

export interface PagoRow {
  id: string;
  fechaPago: string; // ISO
  situacion: string;
  observacion: string;
  proveedor: string | null;
  partida: string;
  importe: number;
  estado: string;
  remesaSemana: string | null; // ISO
}

function lunesDe(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function PagosTable({ pagos }: { pagos: PagoRow[] }) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [semana, setSemana] = useState(() => lunesDe(new Date()).toISOString().slice(0, 10));
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  const seleccionables = useMemo(() => pagos.filter((p) => p.situacion === "TRANSFERENCIA"), [pagos]);
  const nSeleccionados = seleccionados.size;

  function toggle(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    setSeleccionados((prev) =>
      prev.size === seleccionables.length ? new Set() : new Set(seleccionables.map((p) => p.id))
    );
  }

  function asignar() {
    const ids = Array.from(seleccionados);
    startTransition(async () => {
      await asignarRemesaMultiple(ids, semana);
      setMensaje(`${ids.length} transferencia(s) asignada(s) a la remesa del ${formatDate(semana)}.`);
      setSeleccionados(new Set());
    });
  }

  return (
    <div className="space-y-3">
      {nSeleccionados > 0 && (
        <div className="card flex flex-wrap items-center gap-3 border-brand-200 bg-brand-50">
          <span className="text-sm font-medium text-brand-700">
            {nSeleccionados} transferencia(s) seleccionada(s)
          </span>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Semana (lunes):
            <input type="date" value={semana} onChange={(e) => setSemana(e.target.value)} className="input" />
          </label>
          <button type="button" onClick={asignar} disabled={isPending} className="btn-primary">
            {isPending ? "Asignando..." : "Añadir a remesa"}
          </button>
          <button type="button" onClick={() => setSeleccionados(new Set())} className="text-xs text-slate-400 hover:underline">
            Cancelar selección
          </button>
        </div>
      )}

      {mensaje && (
        <div className="card border-semaforo-verde bg-semaforo-verdeBg text-sm text-semaforo-verde">{mensaje}</div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={seleccionables.length > 0 && nSeleccionados === seleccionables.length}
                  onChange={toggleTodos}
                  disabled={seleccionables.length === 0}
                  title="Seleccionar todas las transferencias"
                />
              </th>
              <th>Fecha pago</th>
              <th>Situación</th>
              <th>Observación</th>
              <th>Proveedor</th>
              <th>Partida</th>
              <th className="text-right">Importe</th>
              <th>Estado</th>
              <th>Remesa</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id} className={seleccionados.has(p.id) ? "bg-brand-50/60" : ""}>
                <td>
                  {p.situacion === "TRANSFERENCIA" ? (
                    <input type="checkbox" checked={seleccionados.has(p.id)} onChange={() => toggle(p.id)} />
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
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
                <td className="whitespace-nowrap text-xs text-slate-500">
                  {p.remesaSemana ? formatDate(p.remesaSemana) : "—"}
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
                <td colSpan={10} className="py-8 text-center text-sm text-slate-400">
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
