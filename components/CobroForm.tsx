import { TipoCobro } from "@prisma/client";

function toInputDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function CobroForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  defaultValues?: {
    tipo?: TipoCobro;
    fechaFactura?: Date | null;
    fechaVencimiento?: Date | null;
    factura?: string;
    observacion?: string | null;
    importeTalon?: unknown;
    importeTransferencia?: unknown;
    importeIncidencia?: unknown;
    importeDevolucion?: unknown;
  };
  submitLabel: string;
}) {
  const d = defaultValues ?? {};
  return (
    <form action={action} className="card max-w-2xl space-y-4">
      <div>
        <label className="label">Tipo *</label>
        <select name="tipo" defaultValue={d.tipo ?? "NORMAL"} className="input w-full" required>
          <option value="NORMAL">Cobro normal (talón/transferencia)</option>
          <option value="INCIDENCIA_DEVOLUCION">Incidencia / devolución</option>
        </select>
      </div>

      <div>
        <label className="label">Cliente / factura *</label>
        <input name="factura" defaultValue={d.factura} required className="input w-full" />
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Importe talón (€)</label>
          <input name="importeTalon" defaultValue={d.importeTalon as string} className="input w-full" />
        </div>
        <div>
          <label className="label">Importe transferencia (€)</label>
          <input name="importeTransferencia" defaultValue={d.importeTransferencia as string} className="input w-full" />
        </div>
        <div>
          <label className="label">Importe incidencia (€)</label>
          <input name="importeIncidencia" defaultValue={d.importeIncidencia as string} className="input w-full" />
        </div>
        <div>
          <label className="label">Importe devolución (€)</label>
          <input name="importeDevolucion" defaultValue={d.importeDevolucion as string} className="input w-full" />
        </div>
      </div>

      <div>
        <label className="label">Observación</label>
        <textarea name="observacion" defaultValue={d.observacion ?? ""} className="input w-full" rows={2} />
      </div>

      <button type="submit" className="btn-primary">
        {submitLabel}
      </button>
    </form>
  );
}
