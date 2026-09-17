import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CobroForm } from "@/components/CobroForm";
import { updateCobro } from "@/lib/actions/cobros";

export default async function EditarCobroPage({ params }: { params: { id: string } }) {
  const cobro = await prisma.cobro.findUnique({ where: { id: params.id } });
  if (!cobro) notFound();

  const updateWithId = updateCobro.bind(null, cobro.id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Editar cobro</h1>
      <CobroForm
        action={updateWithId}
        submitLabel="Guardar cambios"
        defaultValues={{
          tipo: cobro.tipo,
          fechaFactura: cobro.fechaFactura,
          fechaVencimiento: cobro.fechaVencimiento,
          factura: cobro.factura,
          observacion: cobro.observacion,
          importeTalon: cobro.importeTalon?.toString(),
          importeTransferencia: cobro.importeTransferencia?.toString(),
          importeIncidencia: cobro.importeIncidencia?.toString(),
          importeDevolucion: cobro.importeDevolucion?.toString(),
        }}
      />
    </div>
  );
}
