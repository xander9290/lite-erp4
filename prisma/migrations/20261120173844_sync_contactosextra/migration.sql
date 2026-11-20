-- CreateTable
CREATE TABLE "contactosextra_partnertags" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contactosextra_partnertags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contactosextra_partnertags_create_by_idx" ON "contactosextra_partnertags"("create_by");

-- AddForeignKey
ALTER TABLE "contactosextra_partnertags" ADD CONSTRAINT "contactosextra_partnertags_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
