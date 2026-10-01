"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/format";
import type { CentroAlertas } from "@/lib/alertas";

export function CentroAlertasBoton({ alertas }: { alertas: CentroAlertas }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { alertasInforme, alertasSaldo, sugerenciasTraspaso, total } = alertas;
  const sinAlertas = total === 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-lg hover:bg-slate-100"
        aria-label="Alertas"
      >
        🔔
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-semaforo-rojo px-1 text-[10px] font-semibold leading-none text-white">
            {total}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-sm font-semibold text-slate-900">Alertas</p>

          {sinAlertas && <p className="text-sm text-slate-400">Sin alertas activas.</p>}

          {sugerenciasTraspaso.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">Traspasos sugeridos</p>
              <ul className="space-y-1.5">
                {sugerenciasTraspaso.map((s, i) => (
                  <li key={i} className="rounded-lg bg-brand-50 p-2 text-xs text-slate-700">
                    Mover <span className="font-semibold">{formatCurrency(s.importe)}</span> de{" "}
                    <span className="font-medium">{s.desdeEntidad}</span> ({s.desdeProducto}) a{" "}
                    <span className="font-medium">{s.haciaEntidad}</span> ({s.haciaProducto})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {alertasSaldo.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">Saldo bajo</p>
              <ul className="space-y-1.5">
                {alertasSaldo.map((a, i) => (
                  <li key={i} className="rounded-lg bg-red-50 p-2 text-xs text-slate-700">
                    <span className="font-medium">
                      {a.entidad} ({a.producto})
                    </span>
                    : {formatCurrency(a.saldo)}, por debajo del umbral de {formatCurrency(a.umbral)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {alertasInforme.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">Informe de posición</p>
              <ul className="space-y-1.5">
                {alertasInforme.map((a, i) => (
                  <li key={i} className="rounded-lg bg-amber-50 p-2 text-xs text-slate-700">
                    {a.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
