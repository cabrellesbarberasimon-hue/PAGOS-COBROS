"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function num(v: FormDataEntryValue | null): number {
  const n = parseFloat(String(v ?? "0").replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}

function pct(v: FormDataEntryValue | null): number {
  return num(v) / 100;
}

export async function updateSupuesto(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const data = {
    facturacionMensual: num(formData.get("facturacionMensual")),
    desfaseCobroMeses: Math.round(num(formData.get("desfaseCobroMeses"))),
    pagosProveedoresMes: num(formData.get("pagosProveedoresMes")),
    gastosFijosMes: num(formData.get("gastosFijosMes")),
    saldoInicialCuentas: num(formData.get("saldoInicialCuentas")),
    saldoInicialCuentasPolizas: num(formData.get("saldoInicialCuentasPolizas")),
    lineaFinanciacionCaixabank: num(formData.get("lineaFinanciacionCaixabank")),
    letrasEnCartera: num(formData.get("letrasEnCartera")),
    pctLetrasCobradasPrimerMes: pct(formData.get("pctLetrasCobradasPrimerMesPct")),
    albaranesGirosACobrar: num(formData.get("albaranesGirosACobrar")),
    seguroNavePrimaAnual: num(formData.get("seguroNavePrimaAnual")),
    pagoMod111Trimestre: num(formData.get("pagoMod111Trimestre")),
    previsionMensual: num(formData.get("previsionMensual")),
    fechaInicioProyeccion: new Date(String(formData.get("fechaInicioProyeccion"))),
    mesesProyeccion: Math.round(num(formData.get("mesesProyeccion"))) || 23,
  };

  if (id) {
    await prisma.supuestoTesoreria.update({ where: { id }, data });
  } else {
    await prisma.supuestoTesoreria.create({ data });
  }

  revalidatePath("/proyeccion");
  revalidatePath("/");
  redirect("/proyeccion");
}

export async function updateInformeInputs(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("No hay supuestos de proyección configurados todavía.");

  await prisma.supuestoTesoreria.update({
    where: { id },
    data: {
      pedidosPendientesServir: num(formData.get("pedidosPendientesServir")),
      inversionesPendientes: num(formData.get("inversionesPendientes")),
      colchonSeguridadMeses: num(formData.get("colchonSeguridadMeses")),
    },
  });

  revalidatePath("/informe");
  redirect("/informe");
}
