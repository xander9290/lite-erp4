-- CreateTable
CREATE TABLE "directory_businessactivity" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directory_businessactivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "directory_businessactivity_code_key" ON "directory_businessactivity"("code");

-- CreateIndex
CREATE INDEX "directory_businessactivity_create_by_idx" ON "directory_businessactivity"("create_by");

-- AddForeignKey
ALTER TABLE "directory_businessactivity" ADD CONSTRAINT "directory_businessactivity_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
