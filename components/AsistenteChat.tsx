"use client";

import { useRef, useState, type FormEvent } from "react";

interface Mensaje {
  role: "user" | "assistant";
  content: string;
}

const SUGERENCIAS = [
  "¿Cuánto necesito para cubrir los pagos de los próximos 30 días?",
  "¿Qué alertas hay activas ahora mismo?",
  "¿Qué cobros están vencidos?",
  "Resume mi situación de bancos",
];

export function AsistenteChat() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  async function enviar(contenido: string) {
    if (!contenido.trim() || cargando) return;
    setError(null);
    const nuevos: Mensaje[] = [...mensajes, { role: "user", content: contenido.trim() }];
    setMensajes(nuevos);
    setTexto("");
    setCargando(true);
    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nuevos }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error inesperado.");
        setMensajes(nuevos);
      } else {
        setMensajes([...nuevos, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setError("No se ha podido contactar con el asistente.");
    } finally {
      setCargando(false);
      setTimeout(() => finRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    enviar(texto);
  }

  return (
    <div className="card flex h-[70vh] max-w-2xl flex-col p-0">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {mensajes.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Prueba a preguntar, por ejemplo:</p>
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                onClick={() => enviar(s)}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {mensajes.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-brand-600 px-3 py-2 text-sm text-white"
                : "mr-auto max-w-[85%] whitespace-pre-wrap rounded-xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-800"
            }
          >
            {m.content}
          </div>
        ))}

        {cargando && <div className="mr-auto max-w-[85%] rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-400">Pensando…</div>}
        {error && <p className="text-sm text-semaforo-rojo">{error}</p>}
        <div ref={finRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-slate-200 p-3">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe tu pregunta…"
          className="input flex-1"
          disabled={cargando}
        />
        <button type="submit" className="btn-primary" disabled={cargando || !texto.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
