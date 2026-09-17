import clsx from "clsx";

export function KpiCard({
  label,
  value,
  tone = "default",
  sub,
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "warning" | "success";
  sub?: string;
}) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={clsx("mt-2 text-2xl font-semibold tabular-nums", {
          "text-slate-900": tone === "default",
          "text-semaforo-rojo": tone === "danger",
          "text-semaforo-ambar": tone === "warning",
          "text-semaforo-verde": tone === "success",
        })}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}
