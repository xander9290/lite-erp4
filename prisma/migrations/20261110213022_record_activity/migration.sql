-- CreateTable
CREATE TABLE "record_activities" (
    "id" TEXT NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "record_id" VARCHAR(100) NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "actor_id" TEXT NOT NULL,
    "body" VARCHAR(4000),
    "changes" JSONB NOT NULL DEFAULT '[]',
    "request_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "record_activities_model_record_id_created_at_id_idx" ON "record_activities"("model", "record_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "record_activities_actor_id_request_id_key" ON "record_activities"("actor_id", "request_id");

-- AddForeignKey
ALTER TABLE "record_activities" ADD CONSTRAINT "record_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
