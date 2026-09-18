import { NavLink } from "@/components/NavLink";
import { getSessionRole } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/pagos", label: "Pagos", icon: "💸" },
  { href: "/cobros", label: "Cobros", icon: "💰" },
  { href: "/cobros-especiales", label: "Cobros especiales", icon: "⚠️", soloSimon: true },
  { href: "/resumen", label: "Resumen", icon: "📋" },
  { href: "/bancos", label: "Bancos", icon: "🏦" },
  { href: "/amortizaciones", label: "Amortizaciones", icon: "📉" },
  { href: "/proyeccion", label: "Proyección", icon: "📈" },
  { href: "/informe", label: "Informe de posición", icon: "🧾" },
  { href: "/importar", label: "Importar Excel", icon: "📥" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getSessionRole();
  const nav = NAV.filter((item) => !item.soloSimon || role === "simon");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white px-3 py-5 md:block">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            C
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-900">CUBI</p>
            <p className="text-xs leading-tight text-slate-500">Tesorería</p>
          </div>
        </div>

        <nav className="space-y-1">
          {nav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <form action="/api/logout" method="POST" className="mt-6 px-2">
          <button type="submit" className="text-xs font-medium text-slate-400 hover:text-slate-600">
            Cerrar sesión
          </button>
        </form>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
              C
            </div>
            <span className="text-sm font-semibold">CUBI Tesorería</span>
          </div>
          <form action="/api/logout" method="POST">
            <button type="submit" className="text-xs font-medium text-slate-400">
              Salir
            </button>
          </form>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 md:hidden">
          {nav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
