"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatMonth } from "@/lib/format";

export function SaldoAmortizacionChart({ datos }: { datos: { fecha: string; saldoFinal: number }[] }) {
  const data = datos.map((d) => ({ ...d, mes: formatMonth(d.fecha) }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickFormatter={(v) => new Intl.NumberFormat("es-ES", { notation: "compact" }).format(v)}
        />
        <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
        <Area type="monotone" dataKey="saldoFinal" stroke="#2563eb" fill="url(#saldoGradient)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
