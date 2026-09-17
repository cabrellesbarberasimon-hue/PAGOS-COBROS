import { PagoForm } from "@/components/PagoForm";
import { createPago } from "@/lib/actions/pagos";

export default function NuevoPagoPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Nuevo pago</h1>
      <PagoForm action={createPago} submitLabel="Crear pago" />
    </div>
  );
}
