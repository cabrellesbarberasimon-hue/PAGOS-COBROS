import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductoForm } from "@/components/ProductoForm";
import { updateProducto } from "@/lib/actions/bancos";

export default async function EditarProductoPage({ params }: { params: { id: string } }) {
  const [producto, entidades] = await Promise.all([
    prisma.productoFinanciero.findUnique({ where: { id: params.id }, include: { entidad: true } }),
    prisma.entidadFinanciera.findMany({ orderBy: { nombre: "asc" } }),
  ]);
  if (!producto) notFound();

  const updateWithId = updateProducto.bind(null, producto.id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Editar producto financiero</h1>
      <ProductoForm
        action={updateWithId}
        submitLabel="Guardar cambios"
        entidadesConocidas={entidades.map((e) => e.nombre)}
        defaultValues={{
          entidadNombre: producto.entidad.nombre,
          tipo: producto.tipo,
          nombre: producto.nombre,
          capitalInicial: producto.capitalInicial?.toString(),
          pendienteManual: producto.pendienteManual?.toString(),
          dispuesto: producto.dispuesto?.toString(),
          disponible: producto.disponible?.toString(),
          tipoInteresTexto: producto.tipoInteresTexto,
          tipoInteresAnualPct: producto.tipoInteresAnual ? (Number(producto.tipoInteresAnual) * 100).toString() : "",
          cuotaMensual: producto.cuotaMensual?.toString(),
          fechaConstitucion: producto.fechaConstitucion,
          fechaPrimerVencimiento: producto.fechaPrimerVencimiento,
          fechaVencimiento: producto.fechaVencimiento,
          numCuotas: producto.numCuotas?.toString(),
          observaciones: producto.observaciones,
        }}
      />
    </div>
  );
}
