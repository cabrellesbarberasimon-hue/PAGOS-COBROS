"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
        active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <span className="w-5 text-center">{icon}</span>
      {label}
    </Link>
  );
}
