// Envío de email vía la API HTTP de Resend (https://resend.com), sin SDK
// propio: es una única llamada POST, y así evitamos una dependencia extra.
// Si no hay RESEND_API_KEY configurada (todavía no se ha dado de alta el
// proveedor de email), se omite el envío en vez de fallar: el resto de la
// app (alertas en pantalla, etc.) sigue funcionando igual.

export interface EnvioEmailResultado {
  enviado: boolean;
  motivo?: string;
}

export async function enviarEmail(opts: {
  asunto: string;
  html: string;
  destinatarios: string[];
}): Promise<EnvioEmailResultado> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERTAS_EMAIL_FROM;

  if (!apiKey || !from || opts.destinatarios.length === 0) {
    return { enviado: false, motivo: "RESEND_API_KEY, ALERTAS_EMAIL_FROM o destinatarios sin configurar" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: opts.destinatarios,
      subject: opts.asunto,
      html: opts.html,
    }),
  });

  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    return { enviado: false, motivo: `Resend respondió ${res.status}: ${texto.slice(0, 300)}` };
  }

  return { enviado: true };
}
