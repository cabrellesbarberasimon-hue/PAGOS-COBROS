import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { categoriaLabel } from "@/lib/cobro-especial";
import { deleteCobroEspecial } from "@/lib/actions/cobros-especiales";
import { CategoriaCobroEspecial } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function CobrosEspecialesPage() {
  const items = await prisma.cobroEspecial.findMany({ orderBy: { categoria: "asc" } });

  const grupos = new Map<CategoriaCobroEspecial, typeof items>();
  for (const i of items) {
    const arr = grupos.get(i.categoria) ?? [];
    arr.push(i);
    grupos.set(i.categoria, arr);
  }

  const total = items.reduce((s, i) => s + Number(i.importe), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cobros especiales</h1>
          <p className="text-sm text-slate-500">
            {items.length} registros · {formatCurrency(total)}
          </p>
        </div>
        <Link href="/cobros-especiales/nuevo" className="btn-primary">
          + Nuevo
        </Link>
      </div>

      {Object.values(CategoriaCobroEspecial).map((cat) => {
        const rows = grupos.get(cat) ?? [];
        if (rows.length === 0) return null;
        const subtotal = rows.reduce((s, r) => s + Number(r.importe), 0);
        return (
          <div key={cat} className="card overflow-x-auto p-0">
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-sm font-semibold text-slate-900">{categoriaLabel(cat)}</h2>
              <span className="text-sm font-medium tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <table className="table-base mt-2">
              <thead>
                <tr>
                  <th>Cliente / factura</th>
                  <th className="text-right">Importe</th>
                  <th>Vencimiento</th>
                  <th>Observaciones</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="max-w-xs truncate">{r.clienteFactura}</td>
                    <td className="text-right tabular-nums">{formatCurrency(r.importe)}</td>
                    <td className="whitespace-nowrap">{formatDate(r.fechaVencimiento)}</td>
                    <td className="max-w-[16rem] truncate text-xs text-slate-500">{r.observaciones}</td>
                    <td className="whitespace-nowrap text-right text-xs">
                      <Link href={`/cobros-especiales/${r.id}/editar`} className="mr-2 text-brand-600 hover:underline">
                        Editar
                      </Link>
                      <form action={deleteCobroEspecial} className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="text-semaforo-rojo hover:underline">
                          Borrar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {items.length === 0 && <p className="text-sm text-slate-400">No hay cobros especiales registrados.</p>}
    </div>
  );
}
