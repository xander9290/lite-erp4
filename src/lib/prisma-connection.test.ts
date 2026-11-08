import assert from "node:assert/strict";
import test from "node:test";
import { prismaConnectionOptions } from "./prisma-connection";

test("Prisma connections enforce UTC while preserving existing URL settings", () => {
  const result = prismaConnectionOptions("postgresql://example:example@localhost:5432/example?schema=clinic&application_name=erp&options=-c%20timezone%3DPacific%2FAuckland%20-c%20statement_timeout%3D10000");
  const url = new URL(result.connectionString);
  assert.equal(result.schema, "clinic");
  assert.equal(url.searchParams.get("application_name"), "erp");
  assert.equal(url.searchParams.get("options"), "-c timezone=Pacific/Auckland -c statement_timeout=10000 -c timezone=UTC");
  assert.equal(prismaConnectionOptions("postgresql://localhost/example").schema, "public");
});
