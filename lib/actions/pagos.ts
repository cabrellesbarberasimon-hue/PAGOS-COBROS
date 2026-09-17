"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { classifyPartida, extractProveedor } from "@/lib/partidas";
import { Partida, SituacionPago, EstadoPago } from "@prisma/client";

function parseDecimalEs(v: FormDataEntryValue | null): number {
  if (!v) return 0;
  return parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || parseFloat(String(v)) || 0;
}

function dateOrNull(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createPago(formData: FormData) {
  const observacion = String(formData.get("observacion") ?? "").trim();
  const fechaPago = dateOrNull(formData.get("fechaPago"));
  if (!observacion || !fechaPago) throw new Error("Observación y fecha de pago son obligatorias");

  const situacion = formData.get("situacion") as SituacionPago;
  const importe = parseDecimalEs(formData.get("importe"));
  const partidaOverride = formData.get("partida") as Partida | null;
  const proveedorOverride = String(formData.get("proveedor") ?? "").trim();
  const estado = (formData.get("estado") as EstadoPago) || "PENDIENTE";

  await prisma.pago.create({
    data: {
      situacion,
      estado,
      fechaFactura: dateOrNull(formData.get("fechaFactura")),
      fechaPago,
      observacion,
      proveedor: proveedorOverride || extractProveedor(observacion),
      partida: partidaOverride || classifyPartida(observacion),
      importe,
    },
  });

  revalidatePath("/pagos");
  revalidatePath("/");
  redirect("/pagos");
}

export async function updatePago(id: string, formData: FormData) {
  const observacion = String(formData.get("observacion") ?? "").trim();
  const fechaPago = dateOrNull(formData.get("fechaPago"));
  if (!observacion || !fechaPago) throw new Error("Observación y fecha de pago son obligatorias");

  await prisma.pago.update({
    where: { id },
    data: {
      situacion: formData.get("situacion") as SituacionPago,
      estado: formData.get("estado") as EstadoPago,
      fechaFactura: dateOrNull(formData.get("fechaFactura")),
      fechaPago,
      observacion,
      proveedor: String(formData.get("proveedor") ?? "").trim() || null,
      partida: formData.get("partida") as Partida,
      importe: parseDecimalEs(formData.get("importe")),
    },
  });

  revalidatePath("/pagos");
  revalidatePath("/");
  redirect("/pagos");
}

export async function deletePago(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.pago.delete({ where: { id } });
  revalidatePath("/pagos");
  revalidatePath("/");
}

export async function togglePagado(formData: FormData) {
  const id = String(formData.get("id"));
  const estadoActual = String(formData.get("estadoActual"));
  await prisma.pago.update({
    where: { id },
    data: { estado: estadoActual === "PAGADO" ? "PENDIENTE" : "PAGADO" },
  });
  revalidatePath("/pagos");
  revalidatePath("/");
}

// --- Remesas semanales de transferencias ---

export async function asignarRemesa(formData: FormData) {
  const id = String(formData.get("id"));
  const semana = String(formData.get("semana"));
  await prisma.pago.update({
    where: { id },
    data: { remesaSemana: semana ? new Date(semana) : null },
  });
  revalidatePath("/pagos/remesas");
}

export async function posponerUnaSemana(formData: FormData) {
  const id = String(formData.get("id"));
  const semanaActual = String(formData.get("semanaActual"));
  const actual = new Date(semanaActual);
  actual.setDate(actual.getDate() + 7);
  await prisma.pago.update({ where: { id }, data: { remesaSemana: actual } });
  revalidatePath("/pagos/remesas");
}
