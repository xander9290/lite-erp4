-- CreateTable
CREATE TABLE "access_user_groups" (
    "user_id" TEXT NOT NULL,
    "group_id" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_user_groups_pkey" PRIMARY KEY ("user_id","group_id")
);

-- CreateTable
CREATE TABLE "access_model_overrides" (
    "group_id" VARCHAR(120) NOT NULL,
    "model" VARCHAR(120) NOT NULL,
    "read" BOOLEAN NOT NULL,
    "create" BOOLEAN NOT NULL,
    "write" BOOLEAN NOT NULL,
    "unlink" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_model_overrides_pkey" PRIMARY KEY ("group_id","model")
);

-- CreateTable
CREATE TABLE "access_rule_states" (
    "rule_id" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_rule_states_pkey" PRIMARY KEY ("rule_id")
);

-- CreateIndex
CREATE INDEX "access_user_groups_group_id_idx" ON "access_user_groups"("group_id");

-- AddForeignKey
ALTER TABLE "access_user_groups" ADD CONSTRAINT "access_user_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

