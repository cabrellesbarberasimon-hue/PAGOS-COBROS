import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { pendienteActual } from "@/lib/tesoreria";
import { deleteProducto } from "@/lib/actions/bancos";

export const dynamic = "force-dynamic";

const TIPO_LABELS: Record<string, string> = {
  PRESTAMO: "Préstamo",
  POLIZA_CREDITO: "Póliza de crédito",
  LEASING: "Leasing",
  LINEA_DESCUENTO: "Línea de descuento",
  CUENTA: "Cuenta",
};

export default async function BancosPage() {
  const entidades = await prisma.entidadFinanciera.findMany({
    include: { productos: { orderBy: { nombre: "asc" } } },
    orderBy: { nombre: "asc" },
  });

  const todosLosProductos = entidades.flatMap((e) => e.productos);
  const deudaTotal = todosLosProductos
    .filter((p) => p.tipo === "PRESTAMO" || p.tipo === "LEASING")
    .reduce((s, p) => s + pendienteActual(p), 0);
  const disponibleTotal = todosLosProductos
    .filter((p) => p.tipo === "POLIZA_CREDITO" || p.tipo === "LINEA_DESCUENTO" || p.tipo === "CUENTA")
    .reduce((s, p) => s + Number(p.disponible ?? 0), 0);
  const cuotaMensualTotal = todosLosProductos.reduce((s, p) => s + Number(p.cuotaMensual ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Bancos</h1>
          <p className="text-sm text-slate-500">Posición bancaria unificada por entidad y producto</p>
        </div>
        <Link href="/bancos/nuevo" className="btn-primary">
          + Nuevo producto
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs font-medium uppercase text-slate-500">Deuda total (préstamos/leasing)</p>
          <p className="mt-2 text-xl font-semibold text-semaforo-rojo">{formatCurrency(deudaTotal)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase text-slate-500">Disponible (cuentas + pólizas)</p>
          <p className="mt-2 text-xl font-semibold text-semaforo-verde">{formatCurrency(disponibleTotal)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase text-slate-500">Cuota mensual total</p>
          <p className="mt-2 text-xl font-semibold">{formatCurrency(cuotaMensualTotal)}</p>
        </div>
      </div>

      {entidades.map((entidad) => (
        <div key={entidad.id} className="card overflow-x-auto p-0">
          <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900">{entidad.nombre}</h2>
          <table className="table-base mt-2">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Tipo</th>
                <th className="text-right">Pendiente</th>
                <th className="text-right">Disponible</th>
                <th>Interés</th>
                <th className="text-right">Cuota</th>
                <th>Vencimiento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entidad.productos.map((p) => (
                <tr key={p.id}>
                  <td className="max-w-[14rem] truncate">{p.nombre}</td>
                  <td className="whitespace-nowrap text-xs text-slate-500">{TIPO_LABELS[p.tipo]}</td>
                  <td className="text-right tabular-nums">
                    {p.tipo === "PRESTAMO" || p.tipo === "LEASING" ? formatCurrency(pendienteActual(p)) : "—"}
                  </td>
                  <td className="text-right tabular-nums">{p.disponible ? formatCurrency(p.disponible) : "—"}</td>
                  <td className="whitespace-nowrap text-xs text-slate-500">{p.tipoInteresTexto ?? "—"}</td>
                  <td className="text-right tabular-nums">{p.cuotaMensual ? formatCurrency(p.cuotaMensual) : "—"}</td>
                  <td className="whitespace-nowrap">{formatDate(p.fechaVencimiento)}</td>
                  <td className="whitespace-nowrap text-right text-xs">
                    {(p.tipo === "PRESTAMO" || p.tipo === "LEASING") && (
                      <Link href={`/amortizaciones/${p.id}`} className="mr-2 text-brand-600 hover:underline">
                        Cuadro
                      </Link>
                    )}
                    <Link href={`/bancos/${p.id}/editar`} className="mr-2 text-brand-600 hover:underline">
                      Editar
                    </Link>
                    <form action={deleteProducto} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="text-semaforo-rojo hover:underline">
                        Borrar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {entidad.productos.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-sm text-slate-400">
                    Sin productos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
