import { ImportarForm } from "@/components/ImportarForm";

export default function ImportarPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Importar Excel / CSV</h1>
        <p className="text-sm text-slate-500">
          Para la carga inicial completa del histórico (pagos, cobros, cobros especiales, bancos y supuestos de
          proyección) usa el script <code>npm run import:excel -- /ruta/al/excel.xlsx</code> descrito en el README.
          Esta pantalla es para altas puntuales de pagos o cobros nuevos según van entrando facturas.
        </p>
      </div>
      <ImportarForm />
    </div>
  );
}
