import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PagoForm } from "@/components/PagoForm";
import { updatePago } from "@/lib/actions/pagos";

export default async function EditarPagoPage({ params }: { params: { id: string } }) {
  const pago = await prisma.pago.findUnique({ where: { id: params.id } });
  if (!pago) notFound();

  const updateWithId = updatePago.bind(null, pago.id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Editar pago</h1>
      <PagoForm
        action={updateWithId}
        submitLabel="Guardar cambios"
        defaultValues={{
          situacion: pago.situacion,
          estado: pago.estado,
          fechaFactura: pago.fechaFactura,
          fechaPago: pago.fechaPago,
          observacion: pago.observacion,
          proveedor: pago.proveedor,
          partida: pago.partida,
          importe: pago.importe.toString(),
        }}
      />
    </div>
  );
}
