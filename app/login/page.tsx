export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; from?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            C
          </div>
          <h1 className="text-lg font-semibold text-slate-900">CUBI · Tesorería</h1>
          <p className="mt-1 text-sm text-slate-500">Pagos, cobros y proyección de tesorería</p>
        </div>

        <form action="/api/login" method="POST" className="space-y-4">
          {searchParams.from ? (
            <input type="hidden" name="from" value={searchParams.from} />
          ) : null}
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Contraseña de acceso
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="esSimon" value="1" className="h-4 w-4 rounded border-slate-300" />
            Soy Simón (acceso completo, incluye Cobros especiales)
          </label>

          {searchParams.error ? (
            <p className="text-sm text-semaforo-rojo">Contraseña incorrecta.</p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
