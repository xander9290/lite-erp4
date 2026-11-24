-- CreateTable
CREATE TABLE "directory_partnertags" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directory_partnertags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "directory_partnertags_create_by_idx" ON "directory_partnertags"("create_by");

-- AddForeignKey
ALTER TABLE "directory_partnertags" ADD CONSTRAINT "directory_partnertags_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
