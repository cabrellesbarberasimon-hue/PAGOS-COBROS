-- CreateEnum
CREATE TYPE "SituacionPago" AS ENUM ('GIRO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'PAGADO');

-- CreateEnum
CREATE TYPE "Partida" AS ENUM ('BANCOS', 'TARJETAS', 'SEGUROS', 'PERSONAL', 'IMPUESTOS', 'VARIOS_PREVISION', 'SUMINISTROS_OTROS', 'PROVEEDORES', 'OTROS');

-- CreateEnum
CREATE TYPE "TipoCobro" AS ENUM ('NORMAL', 'INCIDENCIA_DEVOLUCION');

-- CreateEnum
CREATE TYPE "CategoriaCobroEspecial" AS ENUM ('INSIGNIFICANTE_INACTIVO', 'DUDOSO_COBRO', 'ACTIVO_PENDIENTE', 'FALTA_ABONO', 'ABONO_PENDIENTE', 'PENDIENTE_REVISAR');

-- CreateEnum
CREATE TYPE "TipoProducto" AS ENUM ('PRESTAMO', 'POLIZA_CREDITO', 'LEASING', 'LINEA_DESCUENTO', 'CUENTA');

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "situacion" "SituacionPago" NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "fechaFactura" TIMESTAMP(3),
    "fechaPago" TIMESTAMP(3) NOT NULL,
    "observacion" TEXT NOT NULL,
    "proveedor" TEXT,
    "partida" "Partida" NOT NULL DEFAULT 'OTROS',
    "importe" DECIMAL(12,2) NOT NULL,
    "remesaSemana" TIMESTAMP(3),
    "origenImportacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobro" (
    "id" TEXT NOT NULL,
    "tipo" "TipoCobro" NOT NULL DEFAULT 'NORMAL',
    "fechaFactura" TIMESTAMP(3),
    "fechaVencimiento" TIMESTAMP(3),
    "factura" TEXT NOT NULL,
    "observacion" TEXT,
    "importeTalon" DECIMAL(12,2),
    "importeTransferencia" DECIMAL(12,2),
    "importeIncidencia" DECIMAL(12,2),
    "importeDevolucion" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cobro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CobroEspecial" (
    "id" TEXT NOT NULL,
    "categoria" "CategoriaCobroEspecial" NOT NULL,
    "clienteFactura" TEXT NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "observaciones" TEXT,
    "fechaFactura" TIMESTAMP(3),
    "fechaVencimiento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CobroEspecial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntidadFinanciera" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntidadFinanciera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoFinanciero" (
    "id" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "tipo" "TipoProducto" NOT NULL,
    "nombre" TEXT NOT NULL,
    "capitalInicial" DECIMAL(12,2),
    "pendienteManual" DECIMAL(12,2),
    "dispuesto" DECIMAL(12,2),
    "disponible" DECIMAL(12,2),
    "tipoInteresTexto" TEXT,
    "tipoInteresAnual" DECIMAL(6,4),
    "cuotaMensual" DECIMAL(12,2),
    "fechaConstitucion" TIMESTAMP(3),
    "fechaPrimerVencimiento" TIMESTAMP(3),
    "fechaVencimiento" TIMESTAMP(3),
    "numCuotas" INTEGER,
    "cuadroPersonalizado" JSONB,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoFinanciero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupuestoTesoreria" (
    "id" TEXT NOT NULL,
    "facturacionMensual" DECIMAL(12,2) NOT NULL,
    "desfaseCobroMeses" INTEGER NOT NULL,
    "pagosProveedoresMes" DECIMAL(12,2) NOT NULL,
    "gastosFijosMes" DECIMAL(12,2) NOT NULL,
    "saldoInicialCuentas" DECIMAL(12,2) NOT NULL,
    "saldoInicialCuentasPolizas" DECIMAL(12,2) NOT NULL,
    "lineaFinanciacionCaixabank" DECIMAL(12,2) NOT NULL,
    "letrasEnCartera" DECIMAL(12,2) NOT NULL,
    "pctLetrasCobradasPrimerMes" DECIMAL(5,4) NOT NULL,
    "albaranesGirosACobrar" DECIMAL(12,2) NOT NULL,
    "seguroNavePrimaAnual" DECIMAL(12,2) NOT NULL,
    "pagoMod111Trimestre" DECIMAL(12,2) NOT NULL,
    "previsionMensual" DECIMAL(12,2) NOT NULL,
    "fechaInicioProyeccion" TIMESTAMP(3) NOT NULL,
    "mesesProyeccion" INTEGER NOT NULL DEFAULT 23,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupuestoTesoreria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportacionLog" (
    "id" TEXT NOT NULL,
    "archivo" TEXT NOT NULL,
    "hashContenido" TEXT NOT NULL,
    "filasPagos" INTEGER NOT NULL,
    "filasCobros" INTEGER NOT NULL,
    "ejecutadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pago_fechaPago_idx" ON "Pago"("fechaPago");

-- CreateIndex
CREATE INDEX "Pago_situacion_remesaSemana_idx" ON "Pago"("situacion", "remesaSemana");

-- CreateIndex
CREATE INDEX "Pago_proveedor_idx" ON "Pago"("proveedor");

-- CreateIndex
CREATE INDEX "Pago_partida_idx" ON "Pago"("partida");

-- CreateIndex
CREATE INDEX "Cobro_fechaVencimiento_idx" ON "Cobro"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "Cobro_tipo_idx" ON "Cobro"("tipo");

-- CreateIndex
CREATE INDEX "CobroEspecial_categoria_idx" ON "CobroEspecial"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "EntidadFinanciera_nombre_key" ON "EntidadFinanciera"("nombre");

-- CreateIndex
CREATE INDEX "ProductoFinanciero_entidadId_idx" ON "ProductoFinanciero"("entidadId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportacionLog_hashContenido_key" ON "ImportacionLog"("hashContenido");

-- AddForeignKey
ALTER TABLE "ProductoFinanciero" ADD CONSTRAINT "ProductoFinanciero_entidadId_fkey" FOREIGN KEY ("entidadId") REFERENCES "EntidadFinanciera"("id") ON DELETE CASCADE ON UPDATE CASCADE;
