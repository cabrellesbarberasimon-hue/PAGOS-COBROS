import { NextRequest, NextResponse } from "next/server";
import { obtenerCentroAlertas } from "@/lib/alertas";
import { construirResumenAlertas } from "@/lib/resumen-email";
import { enviarEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Llamado por el cron de Vercel (ver vercel.json) una vez al día. Protegido
// con CRON_SECRET: si está configurada, Vercel la manda automáticamente como
// "Authorization: Bearer <CRON_SECRET>" en cada invocación programada.
function autorizado(req: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return true; // sin secreto configurado, no se puede verificar: se deja pasar
  return req.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const alertas = await obtenerCentroAlertas();
  const { asunto, html } = construirResumenAlertas(alertas);

  const destinatarios = (process.env.ALERTAS_EMAIL_TO ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const resultado = await enviarEmail({ asunto, html, destinatarios });

  return NextResponse.json({
    totalAlertas: alertas.total,
    email: resultado,
  });
}
