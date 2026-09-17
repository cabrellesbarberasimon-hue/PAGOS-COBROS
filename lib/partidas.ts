import { Partida } from "@prisma/client";

// Reproduce la lógica manual de la hoja "Resumen Pagos" del Excel: cada
// partida (categoría de gasto fijo) se identificaba por coincidencia de texto
// contra la observación del pago. Aquí hacemos lo mismo para poder clasificar
// automáticamente al importar y sugerir la partida en el alta manual.
const PARTIDA_KEYWORDS: Array<{ partida: Partida; keywords: string[] }> = [
  {
    partida: Partida.BANCOS,
    keywords: [
      "PRESTAMO SABADELL",
      "PRESTAMO BANKINTER",
      "LEASING BANKINTER",
      "PRESTAMO 2 CAIXA BANK",
      "PRESTAMO CAIXA BANK",
      "DEVOLUCIÓN PRESTAMO IVF",
      "DEVOLUCION PRESTAMO IVF",
      "PRESTAMO IVF",
    ],
  },
  {
    partida: Partida.TARJETAS,
    keywords: ["TARJETA CAIXABANK", "TARJETA SABADELL", "TARJETA BANKINTER"],
  },
  {
    partida: Partida.SEGUROS,
    keywords: ["SEGURO VIDA MYBOX", "SEGUROS", "SECURITAS", "SECUR CAIXA"],
  },
  {
    partida: Partida.PERSONAL,
    keywords: ["SEGURIDAD SOCIAL", "NÓMINAS", "NOMINAS"],
  },
  {
    partida: Partida.IMPUESTOS,
    keywords: ["MOD 111", "MOD111"],
  },
  {
    partida: Partida.VARIOS_PREVISION,
    keywords: ["PREVISION", "PREVISIÓN", "ERP NUEVO"],
  },
  {
    partida: Partida.SUMINISTROS_OTROS,
    keywords: ["ENDESA", "ALQUILER NAVE", "SEGURO NAVE"],
  },
];

export function classifyPartida(observacion: string): Partida {
  const upper = observacion.toUpperCase();

  for (const { partida, keywords } of PARTIDA_KEYWORDS) {
    if (keywords.some((k) => upper.includes(k))) return partida;
  }

  if (/^(dividido\s+)?fra\.?\s/i.test(observacion.trim())) {
    return Partida.PROVEEDORES;
  }

  return Partida.OTROS;
}

const PARTIDA_LABELS: Record<Partida, string> = {
  BANCOS: "Bancos",
  TARJETAS: "Tarjetas",
  SEGUROS: "Seguros",
  PERSONAL: "Personal",
  IMPUESTOS: "Impuestos",
  VARIOS_PREVISION: "Varios / Previsión",
  SUMINISTROS_OTROS: "Suministros / Otros",
  PROVEEDORES: "Proveedores",
  OTROS: "Otros",
};

export function partidaLabel(p: Partida): string {
  return PARTIDA_LABELS[p];
}

// Extrae el nombre de proveedor de observaciones tipo:
//   "Fra. 697, SUCES. DE FRANCISCO FERRI, S.L."
//   "Fra. 2612147, Vto. 4/4, CANTISA, S.A."
//   "Dividido Fra. 725, Vto. 1/3, TABLEROS DE LEVANTE,S.A."
// El proveedor es todo lo que queda tras la primera coma, quitando un
// posible "Vto. n/n," intermedio.
export function extractProveedor(observacion: string): string | null {
  const trimmed = observacion.trim();

  if (/^(dividido\s+)?fra\.?\s/i.test(trimmed)) {
    const afterFirstComma = trimmed.slice(trimmed.indexOf(",") + 1).trim();
    const withoutVto = afterFirstComma.replace(/^vto\.?\s*\d+\/\d+,?\s*/i, "").trim();
    return withoutVto || null;
  }

  // Pagos recurrentes con nombre de proveedor pero sin "Fra." delante, p.ej.
  // "TABLEROS DE LEVANTE, S.A. (pago semanal 8/17)".
  const match = trimmed.match(/^([^(]+?)(?:\s*\(pago[^)]*\))?$/i);
  if (match && classifyPartida(trimmed) === Partida.OTROS) {
    return match[1].trim();
  }

  return null;
}
