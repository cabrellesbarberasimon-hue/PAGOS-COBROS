import { CategoriaCobroEspecial } from "@prisma/client";
import { categoriaLabel } from "@/lib/cobro-especial";

function toInputDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function CobroEspecialForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  defaultValues?: {
    categoria?: CategoriaCobroEspecial;
    clienteFactura?: string;
    importe?: unknown;
    observaciones?: string | null;
    fechaFactura?: Date | null;
    fechaVencimiento?: Date | null;
  };
  submitLabel: string;
}) {
  const d = defaultValues ?? {};
  return (
    <form action={action} className="card max-w-2xl space-y-4">
      <div>
        <label className="label">Categoría *</label>
        <select name="categoria" defaultValue={d.categoria ?? "PENDIENTE_REVISAR"} className="input w-full" required>
          {Object.values(CategoriaCobroEspecial).map((c) => (
            <option key={c} value={c}>
              {categoriaLabel(c)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Cliente / factura *</label>
        <input name="clienteFactura" defaultValue={d.clienteFactura} required className="input w-full" />
      </div>

      <div>
        <label className="label">Importe (€) *</label>
        <input name="importe" defaultValue={d.importe as string} required className="input w-full" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Fecha de factura</label>
          <input type="date" name="fechaFactura" defaultValue={toInputDate(d.fechaFactura)} className="input w-full" />
        </div>
        <div>
          <label className="label">Fecha de vencimiento</label>
          <input
            type="date"
            name="fechaVencimiento"
            defaultValue={toInputDate(d.fechaVencimiento)}
            className="input w-full"
          />
        </div>
      </div>

      <div>
        <label className="label">Observaciones</label>
        <textarea name="observaciones" defaultValue={d.observaciones ?? ""} className="input w-full" rows={2} />
      </div>

      <button type="submit" className="btn-primary">
        {submitLabel}
      </button>
    </form>
  );
}
