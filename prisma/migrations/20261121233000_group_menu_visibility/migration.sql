-- Presentation only: empty table, no changes to memberships, permissions or business records.
CREATE TABLE "access_menu_hidden" (
  "group_id" VARCHAR(120) NOT NULL,
  "application" VARCHAR(120) NOT NULL,
  "menu" VARCHAR(120) NOT NULL,
  CONSTRAINT "access_menu_hidden_pkey" PRIMARY KEY ("group_id", "application", "menu")
);
