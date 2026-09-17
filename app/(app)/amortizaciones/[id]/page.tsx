import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cuadroDeProducto } from "@/lib/tesoreria";
import { formatCurrency, formatDate } from "@/lib/format";
import { SaldoAmortizacionChart } from "@/components/SaldoAmortizacionChart";

export const dynamic = "force-dynamic";

export default async function AmortizacionDetallePage({ params }: { params: { id: string } }) {
  const producto = await prisma.productoFinanciero.findUnique({
    where: { id: params.id },
    include: { entidad: true },
  });
  if (!producto) notFound();

  const cuadro = cuadroDeProducto(producto);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{producto.nombre}</h1>
        <p className="text-sm text-slate-500">{producto.entidad.nombre}</p>
      </div>

      {cuadro.length === 0 ? (
        <p className="card text-sm text-slate-400">
          Este producto no tiene cuota mensual y/o fecha de próximo vencimiento configuradas, así que no se puede
          calcular el cuadro de amortización. Complétalo en{" "}
          <a href={`/bancos/${producto.id}/editar`} className="text-brand-600 hover:underline">
            Editar producto
          </a>
          .
        </p>
      ) : (
        <>
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Evolución del saldo pendiente</h2>
            <SaldoAmortizacionChart
              datos={cuadro.map((f) => ({ fecha: f.fecha.toISOString(), saldoFinal: f.saldoFinal }))}
            />
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Fecha</th>
                  <th className="text-right">Saldo inicial</th>
                  <th className="text-right">Intereses</th>
                  <th className="text-right">Capital</th>
                  <th className="text-right">Cuota</th>
                  <th className="text-right">Saldo final</th>
                </tr>
              </thead>
              <tbody>
                {cuadro.map((f) => (
                  <tr key={f.numero}>
                    <td>{f.numero}</td>
                    <td className="whitespace-nowrap">{formatDate(f.fecha)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(f.saldoInicial)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(f.intereses)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(f.capital)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(f.cuota)}</td>
                    <td className="text-right tabular-nums font-medium">{formatCurrency(f.saldoFinal)}</td>
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
