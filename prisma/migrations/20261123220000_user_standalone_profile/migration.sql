-- Retire core.partner without deleting historical contacts or their linkage.
-- No business rows are removed. New accounts do not require a contact.
BEGIN;

-- Keep the copied profile and its original link in one stable snapshot.
LOCK TABLE "users", "partners" IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "users"
  ADD COLUMN "name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "email" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "avatar_url" TEXT;

UPDATE "users" AS u
SET "name" = COALESCE(NULLIF(p."name", ''), u."login"),
    "email" = p."email",
    "phone" = p."phone",
    "avatar_url" = p."avatar_url",
    "updated_at" = GREATEST(u."updated_at", COALESCE(p."updated_at", u."updated_at")) + INTERVAL '1 millisecond'
FROM "users" AS original
LEFT JOIN "partners" AS p ON p."id" = original."partner_id"
WHERE u."id" = original."id";

-- The nullable partner_id column and its unique index remain only as historical data.
-- Removing the FK makes accounts independent from the archived partners table.
ALTER TABLE "users" DROP CONSTRAINT "users_partner_id_fkey";

COMMIT;
