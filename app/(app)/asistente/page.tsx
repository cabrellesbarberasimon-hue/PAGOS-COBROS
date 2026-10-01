import { AsistenteChat } from "@/components/AsistenteChat";

export default function AsistentePage() {
  const configurado = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Asistente IA</h1>
        <p className="text-sm text-slate-500">
          Responde preguntas sobre la tesorería a partir de los datos reales de la app (no inventa cifras).
        </p>
      </div>

      {configurado ? (
        <AsistenteChat />
      ) : (
        <div className="card max-w-2xl space-y-2 text-sm text-slate-600">
          <p className="font-medium text-slate-900">El asistente todavía no está activado.</p>
          <p>Para activarlo, añade la variable de entorno ANTHROPIC_API_KEY en Vercel:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Crea una cuenta y una API key en{" "}
              <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                console.anthropic.com
              </a>
              .
            </li>
            <li>En Vercel → tu proyecto → Settings → Environment Variables, añade ANTHROPIC_API_KEY con esa clave.</li>
            <li>Vuelve a desplegar (o espera al siguiente deploy).</li>
          </ol>
        </div>
      )}
    </div>
  );
}
