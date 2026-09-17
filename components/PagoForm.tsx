import { Partida } from "@prisma/client";
import { partidaLabel } from "@/lib/partidas";

const PARTIDAS = Object.values(Partida);

function toInputDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function PagoForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  defaultValues?: {
    situacion?: string;
    estado?: string;
    fechaFactura?: Date | null;
    fechaPago?: Date | null;
    observacion?: string;
    proveedor?: string | null;
    partida?: string;
    importe?: number | string;
  };
  submitLabel: string;
}) {
  const d = defaultValues ?? {};
  return (
    <form action={action} className="card max-w-2xl space-y-4">
      <div>
        <label className="label">Observación *</label>
        <input
          name="observacion"
          defaultValue={d.observacion}
          required
          className="input w-full"
          placeholder="Fra. 123, PROVEEDOR S.L."
        />
        <p className="mt-1 text-xs text-slate-400">
          Si empieza por "Fra. Nº, " se intentará extraer el proveedor y la partida automáticamente.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Situación *</label>
          <select name="situacion" defaultValue={d.situacion ?? "TRANSFERENCIA"} className="input w-full" required>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="GIRO">Giro</option>
          </select>
        </div>
        <div>
          <label className="label">Estado</label>
          <select name="estado" defaultValue={d.estado ?? "PENDIENTE"} className="input w-full">
            <option value="PENDIENTE">Pendiente</option>
            <option value="PAGADO">Pagado</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Fecha de factura</label>
          <input type="date" name="fechaFactura" defaultValue={toInputDate(d.fechaFactura)} className="input w-full" />
        </div>
        <div>
          <label className="label">Fecha de pago *</label>
          <input
            type="date"
            name="fechaPago"
            defaultValue={toInputDate(d.fechaPago)}
            required
            className="input w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Proveedor (opcional, se autodetecta)</label>
          <input name="proveedor" defaultValue={d.proveedor ?? ""} className="input w-full" />
        </div>
        <div>
          <label className="label">Partida</label>
          <select name="partida" defaultValue={d.partida ?? ""} className="input w-full">
            <option value="">Autodetectar</option>
            {PARTIDAS.map((p) => (
              <option key={p} value={p}>
                {partidaLabel(p)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Importe (€) *</label>
        <input
          name="importe"
          defaultValue={d.importe}
          required
          inputMode="decimal"
          className="input w-full"
          placeholder="1234,56"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
