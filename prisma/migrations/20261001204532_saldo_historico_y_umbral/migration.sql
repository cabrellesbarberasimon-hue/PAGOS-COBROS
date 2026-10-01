-- AlterTable
ALTER TABLE "ProductoFinanciero" ADD COLUMN     "umbralSaldoMinimo" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "SaldoHistorico" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "saldo" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaldoHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaldoHistorico_productoId_idx" ON "SaldoHistorico"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "SaldoHistorico_productoId_fecha_key" ON "SaldoHistorico"("productoId", "fecha");

-- AddForeignKey
ALTER TABLE "SaldoHistorico" ADD CONSTRAINT "SaldoHistorico_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "ProductoFinanciero"("id") ON DELETE CASCADE ON UPDATE CASCADE;
