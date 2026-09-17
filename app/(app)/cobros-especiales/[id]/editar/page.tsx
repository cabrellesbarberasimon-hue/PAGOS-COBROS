import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CobroEspecialForm } from "@/components/CobroEspecialForm";
import { updateCobroEspecial } from "@/lib/actions/cobros-especiales";

export default async function EditarCobroEspecialPage({ params }: { params: { id: string } }) {
  const item = await prisma.cobroEspecial.findUnique({ where: { id: params.id } });
  if (!item) notFound();

  const updateWithId = updateCobroEspecial.bind(null, item.id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Editar cobro especial</h1>
      <CobroEspecialForm
        action={updateWithId}
        submitLabel="Guardar cambios"
        defaultValues={{
          categoria: item.categoria,
          clienteFactura: item.clienteFactura,
          importe: item.importe.toString(),
          observaciones: item.observaciones,
          fechaFactura: item.fechaFactura,
          fechaVencimiento: item.fechaVencimiento,
        }}
      />
    </div>
  );
}
