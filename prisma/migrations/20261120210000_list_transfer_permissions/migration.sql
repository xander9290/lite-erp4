-- New permissions default to no grant; existing CRUD permissions are preserved.
ALTER TABLE "access_model_overrides"
  ADD COLUMN "can_import" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "can_export" BOOLEAN NOT NULL DEFAULT false;
