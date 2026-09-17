import { TipoProducto } from "@prisma/client";

function toInputDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

const TIPO_LABELS: Record<TipoProducto, string> = {
  PRESTAMO: "Préstamo",
  POLIZA_CREDITO: "Póliza de crédito",
  LEASING: "Leasing",
  LINEA_DESCUENTO: "Línea de descuento",
  CUENTA: "Cuenta",
};

export function ProductoForm({
  action,
  submitLabel,
  entidadesConocidas,
  defaultValues,
}: {
  action: (formData: FormData) => void;
  submitLabel: string;
  entidadesConocidas: string[];
  defaultValues?: {
    entidadNombre?: string;
    tipo?: TipoProducto;
    nombre?: string;
    capitalInicial?: unknown;
    pendienteManual?: unknown;
    dispuesto?: unknown;
    disponible?: unknown;
    tipoInteresTexto?: string | null;
    tipoInteresAnualPct?: unknown;
    cuotaMensual?: unknown;
    fechaConstitucion?: Date | null;
    fechaPrimerVencimiento?: Date | null;
    fechaVencimiento?: Date | null;
    numCuotas?: unknown;
    observaciones?: string | null;
  };
}) {
  const d = defaultValues ?? {};
  return (
    <form action={action} className="card max-w-2xl space-y-4">
      <datalist id="entidades-conocidas">
        {entidadesConocidas.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Entidad *</label>
          <input
            name="entidadNombre"
            defaultValue={d.entidadNombre}
            required
            list="entidades-conocidas"
            className="input w-full"
          />
        </div>
        <div>
          <label className="label">Tipo de producto *</label>
          <select name="tipo" defaultValue={d.tipo ?? "PRESTAMO"} className="input w-full" required>
            {Object.entries(TIPO_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Nombre del producto *</label>
        <input name="nombre" defaultValue={d.nombre} required className="input w-full" placeholder="Préstamo COVID ICO" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Capital inicial / límite (€)</label>
          <input name="capitalInicial" defaultValue={d.capitalInicial as string} className="input w-full" />
        </div>
        <div>
          <label className="label">Pendiente actual (€)</label>
          <input name="pendienteManual" defaultValue={d.pendienteManual as string} className="input w-full" />
        </div>
        <div>
          <label className="label">Dispuesto (€)</label>
          <input name="dispuesto" defaultValue={d.dispuesto as string} className="input w-full" />
        </div>
        <div>
          <label className="label">Disponible (€)</label>
          <input name="disponible" defaultValue={d.disponible as string} className="input w-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Tipo de interés (texto)</label>
          <input name="tipoInteresTexto" defaultValue={d.tipoInteresTexto ?? ""} className="input w-full" placeholder="2% FIJO" />
        </div>
        <div>
          <label className="label">Tipo de interés anual (%)</label>
          <input name="tipoInteresAnualPct" defaultValue={d.tipoInteresAnualPct as string} className="input w-full" placeholder="2" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Cuota mensual (€)</label>
          <input name="cuotaMensual" defaultValue={d.cuotaMensual as string} className="input w-full" />
        </div>
        <div>
          <label className="label">Nº cuotas restantes (opcional)</label>
          <input name="numCuotas" defaultValue={d.numCuotas as string} className="input w-full" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Constitución</label>
          <input type="date" name="fechaConstitucion" defaultValue={toInputDate(d.fechaConstitucion)} className="input w-full" />
        </div>
        <div>
          <label className="label">Próximo vencimiento</label>
          <input
            type="date"
            name="fechaPrimerVencimiento"
            defaultValue={toInputDate(d.fechaPrimerVencimiento)}
            className="input w-full"
          />
          <p className="mt-1 text-xs text-slate-400">Fecha de la próxima cuota, para calcular el cuadro.</p>
        </div>
        <div>
          <label className="label">Vencimiento final</label>
          <input type="date" name="fechaVencimiento" defaultValue={toInputDate(d.fechaVencimiento)} className="input w-full" />
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
