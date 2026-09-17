"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TipoProducto } from "@prisma/client";

function num(v: FormDataEntryValue | null): number | null {
  if (!v || String(v).trim() === "") return null;
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function pct(v: FormDataEntryValue | null): number | null {
  const n = num(v);
  return n === null ? null : n / 100;
}

function dateOrNull(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function resolveEntidadId(nombre: string): Promise<string> {
  const entidad = await prisma.entidadFinanciera.upsert({
    where: { nombre },
    update: {},
    create: { nombre },
  });
  return entidad.id;
}

async function buildData(formData: FormData) {
  const entidadNombre = String(formData.get("entidadNombre") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!entidadNombre || !nombre) throw new Error("Entidad y nombre del producto son obligatorios");

  return {
    entidadId: await resolveEntidadId(entidadNombre),
    tipo: formData.get("tipo") as TipoProducto,
    nombre,
    capitalInicial: num(formData.get("capitalInicial")),
    pendienteManual: num(formData.get("pendienteManual")),
    dispuesto: num(formData.get("dispuesto")),
    disponible: num(formData.get("disponible")),
    tipoInteresTexto: String(formData.get("tipoInteresTexto") ?? "").trim() || null,
    tipoInteresAnual: pct(formData.get("tipoInteresAnualPct")),
    cuotaMensual: num(formData.get("cuotaMensual")),
    fechaConstitucion: dateOrNull(formData.get("fechaConstitucion")),
    fechaPrimerVencimiento: dateOrNull(formData.get("fechaPrimerVencimiento")),
    fechaVencimiento: dateOrNull(formData.get("fechaVencimiento")),
    numCuotas: num(formData.get("numCuotas")),
    observaciones: String(formData.get("observaciones") ?? "").trim() || null,
  };
}

export async function createProducto(formData: FormData) {
  await prisma.productoFinanciero.create({ data: await buildData(formData) });
  revalidatePath("/bancos");
  revalidatePath("/");
  redirect("/bancos");
}

export async function updateProducto(id: string, formData: FormData) {
  await prisma.productoFinanciero.update({ where: { id }, data: await buildData(formData) });
  revalidatePath("/bancos");
  revalidatePath("/");
  redirect("/bancos");
}

export async function deleteProducto(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.productoFinanciero.delete({ where: { id } });
  revalidatePath("/bancos");
  revalidatePath("/");
}
