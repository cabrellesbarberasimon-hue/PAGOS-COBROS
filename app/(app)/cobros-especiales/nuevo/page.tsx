import { CobroEspecialForm } from "@/components/CobroEspecialForm";
import { createCobroEspecial } from "@/lib/actions/cobros-especiales";

export default function NuevoCobroEspecialPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Nuevo cobro especial</h1>
      <CobroEspecialForm action={createCobroEspecial} submitLabel="Crear" />
    </div>
  );
}
