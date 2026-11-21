-- Empty tables add opt-in policies without changing existing groups or permissions.
CREATE TABLE "access_field_restrictions" (
  "group_id" VARCHAR(120) NOT NULL,
  "model" VARCHAR(120) NOT NULL,
  "field" VARCHAR(120) NOT NULL,
  "no_read" BOOLEAN NOT NULL DEFAULT false,
  "no_write" BOOLEAN NOT NULL DEFAULT false,
  "invisible" BOOLEAN NOT NULL DEFAULT false,
  "read_only" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "access_field_restrictions_pkey" PRIMARY KEY ("group_id", "model", "field")
);
CREATE TABLE "access_action_restrictions" (
  "group_id" VARCHAR(120) NOT NULL,
  "model" VARCHAR(120) NOT NULL,
  "action" VARCHAR(120) NOT NULL,
  CONSTRAINT "access_action_restrictions_pkey" PRIMARY KEY ("group_id", "model", "action")
);
