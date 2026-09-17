import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CUBI · Tesorería",
  description: "Gestión de pagos, cobros y proyección de tesorería de CUBI Mobiliario de Diseño SL",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="text-slate-900 antialiased">{children}</body>
    </html>
  );
}
