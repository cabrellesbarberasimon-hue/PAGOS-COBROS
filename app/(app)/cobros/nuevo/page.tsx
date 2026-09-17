import { CobroForm } from "@/components/CobroForm";
import { createCobro } from "@/lib/actions/cobros";

export default function NuevoCobroPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Nuevo cobro</h1>
      <CobroForm action={createCobro} submitLabel="Crear cobro" />
    </div>
  );
}
