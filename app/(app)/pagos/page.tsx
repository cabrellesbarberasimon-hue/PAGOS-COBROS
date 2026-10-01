import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { PagosTable } from "@/components/PagosTable";
import { Prisma, SituacionPago, EstadoPago } from "@prisma/client";

export const dynamic = "force-dynamic";

interface Filtros {
  proveedor?: string;
  situacion?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
}

export default async function PagosPage({ searchParams }: { searchParams: Filtros }) {
  const where: Prisma.PagoWhereInput = {};

  if (searchParams.proveedor) {
    where.OR = [
      { proveedor: { contains: searchParams.proveedor, mode: "insensitive" } },
      { observacion: { contains: searchParams.proveedor, mode: "insensitive" } },
    ];
  }
  if (searchParams.situacion) where.situacion = searchParams.situacion as SituacionPago;
  if (searchParams.estado) where.estado = searchParams.estado as EstadoPago;
  if (searchParams.desde || searchParams.hasta) {
    where.fechaPago = {};
    if (searchParams.desde) where.fechaPago.gte = new Date(searchParams.desde);
    if (searchParams.hasta) where.fechaPago.lte = new Date(searchParams.hasta);
  }

  const pagos = await prisma.pago.findMany({ where, orderBy: { fechaPago: "asc" } });
  const total = pagos.reduce((s, p) => s + Number(p.importe), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Pagos</h1>
          <p className="text-sm text-slate-500">
            {pagos.length} pagos · {formatCurrency(total)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/pagos/remesas" className="btn-secondary">
            Remesas semanales de trf
          </Link>
          <Link href="/importar" className="btn-secondary">
            Importar Excel/CSV
          </Link>
          <Link href="/pagos/nuevo" className="btn-primary">
            + Nuevo pago
          </Link>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-3" method="GET">
        <div>
          <label className="label">Proveedor / texto</label>
          <input name="proveedor" defaultValue={searchParams.proveedor} className="input" placeholder="Buscar..." />
        </div>
        <div>
          <label className="label">Situación</label>
          <select name="situacion" defaultValue={searchParams.situacion ?? ""} className="input">
            <option value="">Todas</option>
            <option value="GIRO">Giro</option>
            <option value="TRANSFERENCIA">Transferencia</option>
          </select>
        </div>
        <div>
          <label className="label">Estado</label>
          <select name="estado" defaultValue={searchParams.estado ?? ""} className="input">
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PAGADO">Pagado</option>
          </select>
        </div>
        <div>
          <label className="label">Desde</label>
          <input type="date" name="desde" defaultValue={searchParams.desde} className="input" />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input type="date" name="hasta" defaultValue={searchParams.hasta} className="input" />
        </div>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
        <Link href="/pagos" className="text-xs text-slate-400 hover:underline">
          Limpiar
        </Link>
      </form>

      <PagosTable
        pagos={pagos.map((p) => ({
          id: p.id,
          fechaPago: p.fechaPago.toISOString(),
          situacion: p.situacion,
          observacion: p.observacion,
          proveedor: p.proveedor,
          partida: p.partida,
          importe: Number(p.importe),
          estado: p.estado,
          remesaSemana: p.remesaSemana ? p.remesaSemana.toISOString() : null,
        }))}
      />
    </div>
  );
}
