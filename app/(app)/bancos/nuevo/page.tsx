import { prisma } from "@/lib/prisma";
import { ProductoForm } from "@/components/ProductoForm";
import { createProducto } from "@/lib/actions/bancos";

export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  const entidades = await prisma.entidadFinanciera.findMany({ orderBy: { nombre: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Nuevo producto financiero</h1>
      <ProductoForm action={createProducto} submitLabel="Crear" entidadesConocidas={entidades.map((e) => e.nombre)} />
    </div>
  );
}
