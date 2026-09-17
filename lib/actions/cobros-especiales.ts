"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategoriaCobroEspecial } from "@prisma/client";

function num(v: FormDataEntryValue | null): number {
  const n = parseFloat(String(v ?? "0").replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}

function dateOrNull(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildData(formData: FormData) {
  const clienteFactura = String(formData.get("clienteFactura") ?? "").trim();
  if (!clienteFactura) throw new Error("Cliente/factura es obligatorio");

  return {
    categoria: formData.get("categoria") as CategoriaCobroEspecial,
    clienteFactura,
    importe: num(formData.get("importe")),
    observaciones: String(formData.get("observaciones") ?? "").trim() || null,
    fechaFactura: dateOrNull(formData.get("fechaFactura")),
    fechaVencimiento: dateOrNull(formData.get("fechaVencimiento")),
  };
}

export async function createCobroEspecial(formData: FormData) {
  await prisma.cobroEspecial.create({ data: buildData(formData) });
  revalidatePath("/cobros-especiales");
  redirect("/cobros-especiales");
}

export async function updateCobroEspecial(id: string, formData: FormData) {
  await prisma.cobroEspecial.update({ where: { id }, data: buildData(formData) });
  revalidatePath("/cobros-especiales");
  redirect("/cobros-especiales");
}

export async function deleteCobroEspecial(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.cobroEspecial.delete({ where: { id } });
  revalidatePath("/cobros-especiales");
}
