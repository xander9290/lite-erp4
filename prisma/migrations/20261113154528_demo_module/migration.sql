-- CreateEnum
CREATE TYPE "demo_tarea_estado" AS ENUM ('pendiente', 'curso', 'hecha');

-- CreateTable
CREATE TABLE "demo_tarea" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "categoria" TEXT NOT NULL,
    "estado" "demo_tarea_estado" NOT NULL DEFAULT 'pendiente',
    "prioridad" INTEGER DEFAULT 3,
    "vence" TIMESTAMPTZ(3),
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_categoria" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_categoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demo_tarea_categoria_idx" ON "demo_tarea"("categoria");

-- CreateIndex
CREATE INDEX "demo_tarea_create_by_idx" ON "demo_tarea"("create_by");

-- CreateIndex
CREATE INDEX "demo_categoria_create_by_idx" ON "demo_categoria"("create_by");

-- AddForeignKey
ALTER TABLE "demo_tarea" ADD CONSTRAINT "demo_tarea_categoria_fkey" FOREIGN KEY ("categoria") REFERENCES "demo_categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_tarea" ADD CONSTRAINT "demo_tarea_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_categoria" ADD CONSTRAINT "demo_categoria_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
