"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TipoCobro } from "@prisma/client";

function num(v: FormDataEntryValue | null): number | null {
  if (!v || String(v).trim() === "") return null;
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function dateOrNull(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildData(formData: FormData) {
  const factura = String(formData.get("factura") ?? "").trim();
  if (!factura) throw new Error("La factura/cliente es obligatoria");

  return {
    tipo: formData.get("tipo") as TipoCobro,
    fechaFactura: dateOrNull(formData.get("fechaFactura")),
    fechaVencimiento: dateOrNull(formData.get("fechaVencimiento")),
    factura,
    observacion: String(formData.get("observacion") ?? "").trim() || null,
    importeTalon: num(formData.get("importeTalon")),
    importeTransferencia: num(formData.get("importeTransferencia")),
    importeIncidencia: num(formData.get("importeIncidencia")),
    importeDevolucion: num(formData.get("importeDevolucion")),
  };
}

export async function createCobro(formData: FormData) {
  await prisma.cobro.create({ data: buildData(formData) });
  revalidatePath("/cobros");
  revalidatePath("/");
  redirect("/cobros");
}

export async function updateCobro(id: string, formData: FormData) {
  await prisma.cobro.update({ where: { id }, data: buildData(formData) });
  revalidatePath("/cobros");
  revalidatePath("/");
  redirect("/cobros");
}

export async function deleteCobro(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.cobro.delete({ where: { id } });
  revalidatePath("/cobros");
  revalidatePath("/");
}
