"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatMonth } from "@/lib/format";

export interface PuntoProyeccion {
  fecha: string; // ISO
  saldoSinPoliza: number;
  saldoConPolizas: number;
  saldoConLineaCaixabank: number;
}

export function ProyeccionChart({ datos }: { datos: PuntoProyeccion[] }) {
  const data = datos.map((d) => ({ ...d, mes: formatMonth(d.fecha) }));

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickFormatter={(v) => new Intl.NumberFormat("es-ES", { notation: "compact" }).format(v)}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          labelFormatter={(label) => `Mes: ${label}`}
          contentStyle={{ borderRadius: 8, fontSize: 13 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="saldoSinPoliza"
          name="Saldo sin póliza"
          stroke="#64748b"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="saldoConPolizas"
          name="Saldo con pólizas actuales"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="saldoConLineaCaixabank"
          name="Saldo con línea CaixaBank adicional"
          stroke="#16a34a"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
