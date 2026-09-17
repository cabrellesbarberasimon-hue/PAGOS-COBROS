import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { pendienteActual } from "@/lib/tesoreria";

export const dynamic = "force-dynamic";

export default async function AmortizacionesPage() {
  const productos = await prisma.productoFinanciero.findMany({
    where: { tipo: { in: ["PRESTAMO", "LEASING"] } },
    include: { entidad: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Amortizaciones</h1>
        <p className="text-sm text-slate-500">Cuadro de amortización de cada préstamo/leasing</p>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>Entidad</th>
              <th>Producto</th>
              <th className="text-right">Pendiente</th>
              <th className="text-right">Cuota mensual</th>
              <th>Vencimiento final</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id}>
                <td>{p.entidad.nombre}</td>
                <td className="max-w-[14rem] truncate">{p.nombre}</td>
                <td className="text-right tabular-nums">{formatCurrency(pendienteActual(p))}</td>
                <td className="text-right tabular-nums">{p.cuotaMensual ? formatCurrency(p.cuotaMensual) : "—"}</td>
                <td className="whitespace-nowrap">{formatDate(p.fechaVencimiento)}</td>
                <td className="text-right text-xs">
                  <Link href={`/amortizaciones/${p.id}`} className="text-brand-600 hover:underline">
                    Ver cuadro →
                  </Link>
                </td>
              </tr>
            ))}
            {productos.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                  No hay préstamos ni leasings registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
