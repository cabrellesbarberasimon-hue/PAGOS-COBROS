-- AlterTable
ALTER TABLE "SupuestoTesoreria" ADD COLUMN     "colchonSeguridadMeses" DECIMAL(4,1) NOT NULL DEFAULT 3,
ADD COLUMN     "inversionesPendientes" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pedidosPendientesServir" DECIMAL(12,2) NOT NULL DEFAULT 0;
