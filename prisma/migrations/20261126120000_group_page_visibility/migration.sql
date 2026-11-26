-- Empty opt-in table: hides Notebook pages per group (presentation only).
CREATE TABLE "access_page_hidden" (
  "group_id" VARCHAR(120) NOT NULL,
  "model" VARCHAR(120) NOT NULL,
  "screen" VARCHAR(60) NOT NULL,
  "layout" VARCHAR(10) NOT NULL,
  "notebook" VARCHAR(60) NOT NULL,
  "page" VARCHAR(60) NOT NULL,
  CONSTRAINT "access_page_hidden_pkey" PRIMARY KEY ("group_id", "model", "screen", "layout", "notebook", "page")
);
