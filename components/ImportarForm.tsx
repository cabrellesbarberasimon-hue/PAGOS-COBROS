"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";

interface PreviewResponse {
  tipo: string;
  total: number;
  duplicados: number;
  aInsertar: number;
  warnings: string[];
  muestra: Array<Record<string, unknown>>;
  error?: string;
}

interface ConfirmResponse {
  insertados: number;
  omitidosPorDuplicado: number;
  warnings: string[];
  error?: string;
}

export function ImportarForm() {
  const [tipo, setTipo] = useState<"pagos" | "cobros">("pagos");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [resultado, setResultado] = useState<ConfirmResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("tipo", tipo);
      fd.set("confirmar", "false");
      const res = await fetch("/api/importar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al previsualizar");
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmar() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("tipo", tipo);
      fd.set("confirmar", "true");
      const res = await fetch("/api/importar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al importar");
      setResultado(data);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div>
          <label className="label">¿Qué vas a importar?</label>
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as "pagos" | "cobros");
              setPreview(null);
              setResultado(null);
            }}
            className="input w-full max-w-xs"
          >
            <option value="pagos">Pagos</option>
            <option value="cobros">Cobros</option>
          </select>
        </div>

        <div>
          <label className="label">Fichero (.xlsx original o .csv)</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setResultado(null);
            }}
            className="block text-sm"
          />
          <p className="mt-2 text-xs text-slate-400">
            Puedes subir el Excel con el formato original (hoja PAGOS o COBROS), o un CSV con cabecera:
            <br />
            Pagos: <code>fecha_pago,situacion,observacion,importe,fecha_factura</code>
            <br />
            Cobros: <code>fecha_factura,fecha_vencimiento,factura,talon,transferencia,observacion</code>
          </p>
        </div>

        <button type="button" onClick={handlePreview} disabled={!file || loading} className="btn-primary">
          {loading ? "Procesando..." : "Previsualizar"}
        </button>
      </div>

      {error && <div className="card border-semaforo-rojo bg-semaforo-rojoBg text-sm text-semaforo-rojo">{error}</div>}

      {preview && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Previsualización</h2>
          <div className="flex gap-6 text-sm">
            <span>
              Total filas leídas: <strong>{preview.total}</strong>
            </span>
            <span>
              Se importarán: <strong className="text-semaforo-verde">{preview.aInsertar}</strong>
            </span>
            <span>
              Duplicados (se omiten): <strong className="text-semaforo-ambar">{preview.duplicados}</strong>
            </span>
          </div>

          {preview.warnings.length > 0 && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer font-medium">Avisos ({preview.warnings.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-100">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>{tipo === "pagos" ? "Observación" : "Factura"}</th>
                  <th className="text-right">Importe</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {preview.muestra.map((row, i) => (
                  <tr key={i} className={row.duplicado ? "opacity-50" : ""}>
                    <td className="whitespace-nowrap">
                      {formatDate((row.fechaPago ?? row.fechaVencimiento) as string)}
                    </td>
                    <td className="max-w-xs truncate">{(row.observacion ?? row.factura) as string}</td>
                    <td className="text-right tabular-nums">
                      {formatCurrency((row.importe ?? row.importeTalon ?? row.importeTransferencia) as number)}
                    </td>
                    <td className="text-xs">
                      {row.duplicado ? (
                        <span className="badge bg-slate-100 text-slate-500">Ya existe, se omite</span>
                      ) : (
                        <span className="badge bg-semaforo-verdeBg text-semaforo-verde">Nuevo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={handleConfirmar} disabled={loading} className="btn-primary">
            {loading ? "Importando..." : `Confirmar e importar ${preview.aInsertar} registro(s)`}
          </button>
        </div>
      )}

      {resultado && (
        <div className="card border-semaforo-verde bg-semaforo-verdeBg text-sm text-semaforo-verde">
          ✔ Importación completada: {resultado.insertados} registro(s) añadidos, {resultado.omitidosPorDuplicado}{" "}
          omitido(s) por duplicado.
        </div>
      )}
    </div>
  );
}
