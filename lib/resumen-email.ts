import type { CentroAlertas } from "./alertas";
import { formatCurrency } from "./format";

// Construye el asunto y el cuerpo HTML del resumen diario de alertas que
// manda el cron (app/api/cron/resumen). Se mantiene separado de lib/email.ts
// (que solo sabe enviar) y de lib/alertas.ts (que solo calcula), para poder
// cambiar el formato del mensaje sin tocar ninguna de las dos cosas.

export function construirResumenAlertas(alertas: CentroAlertas): { asunto: string; html: string } {
  const { alertasInforme, alertasSaldo, sugerenciasTraspaso, total } = alertas;
  const fecha = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());

  const asunto =
    total === 0
      ? `BOCUBI Tesorería · Sin alertas (${fecha})`
      : `BOCUBI Tesorería · ${total} alerta${total === 1 ? "" : "s"} activa${total === 1 ? "" : "s"} (${fecha})`;

  const seccion = (titulo: string, items: string[]) =>
    items.length === 0
      ? ""
      : `<h2 style="font-size:14px;margin:16px 0 6px;color:#0f172a;">${titulo}</h2>
         <ul style="margin:0;padding-left:18px;font-size:13px;color:#334155;">
           ${items.map((i) => `<li style="margin-bottom:4px;">${i}</li>`).join("")}
         </ul>`;

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;">
      <h1 style="font-size:18px;color:#0f172a;">Resumen de tesorería — ${fecha}</h1>
      ${
        total === 0
          ? `<p style="font-size:13px;color:#475569;">Sin alertas activas hoy.</p>`
          : `<p style="font-size:13px;color:#475569;">${total} alerta${total === 1 ? "" : "s"} activa${total === 1 ? "" : "s"} en este momento:</p>`
      }
      ${seccion(
        "Traspasos sugeridos",
        sugerenciasTraspaso.map(
          (s) =>
            `Mover <strong>${formatCurrency(s.importe)}</strong> de ${s.desdeEntidad} (${s.desdeProducto}) a ${s.haciaEntidad} (${s.haciaProducto})`
        )
      )}
      ${seccion(
        "Saldo bajo",
        alertasSaldo.map(
          (a) =>
            `${a.entidad} (${a.producto}): ${formatCurrency(a.saldo)}, por debajo del umbral de ${formatCurrency(a.umbral)}`
        )
      )}
      ${seccion(
        "Informe de posición",
        alertasInforme.map((a) => a.label)
      )}
      <p style="margin-top:20px;font-size:11px;color:#94a3b8;">Generado automáticamente por la app de tesorería de BOCUBI.</p>
    </div>
  `;

  return { asunto, html };
}
