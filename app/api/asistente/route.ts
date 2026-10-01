import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AI_TOOLS, construirContextoAi, ejecutarHerramientaAi } from "@/lib/ai-tools";

export const dynamic = "force-dynamic";

const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_TURNOS_HERRAMIENTAS = 6;

const SYSTEM_PROMPT = `Eres el asistente de tesorería de la app interna de BOCUBI Mobiliario de Diseño SL.
Respondes siempre en español, de forma breve y concreta.
Para cualquier pregunta sobre cifras (saldos, pagos, cobros, alertas, proyección) DEBES usar las
herramientas disponibles en vez de inventar o estimar números: son la única fuente de verdad.
Si una herramienta devuelve un error (por ejemplo, porque no hay supuestos de proyección
configurados), explícaselo al usuario en vez de inventar una respuesta.
No das consejos legales ni fiscales definitivos; para eso remite a un asesor.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "El asistente no está configurado todavía. Añade ANTHROPIC_API_KEY en las variables de entorno." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const mensajes: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
  if (mensajes.length === 0) {
    return NextResponse.json({ error: "Falta el mensaje." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const contexto = await construirContextoAi();

  const historial: Anthropic.MessageParam[] = mensajes.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let ultimaRespuesta: Anthropic.Message | null = null;

  for (let turno = 0; turno < MAX_TURNOS_HERRAMIENTAS; turno++) {
    const respuesta = await client.messages.create({
      model: MODELO,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: AI_TOOLS,
      messages: historial,
    });
    ultimaRespuesta = respuesta;

    if (respuesta.stop_reason !== "tool_use") break;

    historial.push({ role: "assistant", content: respuesta.content });

    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const bloque of respuesta.content) {
      if (bloque.type !== "tool_use") continue;
      let resultado: unknown;
      try {
        resultado = ejecutarHerramientaAi(bloque.name, bloque.input as Record<string, unknown>, contexto);
      } catch (err) {
        resultado = { error: err instanceof Error ? err.message : "Error ejecutando la herramienta." };
      }
      resultados.push({
        type: "tool_result",
        tool_use_id: bloque.id,
        content: JSON.stringify(resultado),
      });
    }
    historial.push({ role: "user", content: resultados });
  }

  const texto =
    ultimaRespuesta?.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n") || "No he podido generar una respuesta.";

  return NextResponse.json({ reply: texto });
}
