import assert from "node:assert/strict";
import test from "node:test";
import { assertNoUniqueDuplicates, duplicateQuery, uniqueIndexMigration, uniqueIndexMigrationSQL } from "./unique-indexes";

const compound = '-- CreateIndex\nCREATE UNIQUE INDEX "ubicaciones_municipio_estado_id_codigo_key" ON "ubicaciones_municipio"("estado_id", "codigo");\n';

test("only diffs made exclusively of unique indexes bypass Prisma's interactive prompt", () => {
  assert.deepEqual(uniqueIndexMigration(compound), [{ name: "ubicaciones_municipio_estado_id_codigo_key", table: "ubicaciones_municipio", columns: ["estado_id", "codigo"] }]);
  const simple = '-- CreateIndex\r\nCREATE UNIQUE INDEX "pais_codigo_key" ON "pais"("codigo");\r\n';
  assert.deepEqual(uniqueIndexMigration(`${compound}\n${simple}`)?.map(index => index.columns), [["estado_id", "codigo"], ["codigo"]]);
  assert.deepEqual(uniqueIndexMigration('CREATE UNIQUE INDEX "a""b" ON "t""x"("c""d");')?.[0], { name: 'a"b', table: 't"x', columns: ['c"d'] });
  for (const sql of [
    "", "-- empty\n",
    'CREATE INDEX "plain" ON "t"("c");',
    'ALTER TABLE "t" ADD COLUMN "c" TEXT;',
    `${compound}ALTER TABLE "t" ADD COLUMN "c" TEXT;`,
    'CREATE UNIQUE INDEX "x" ON "t"("c"); DROP TABLE "t";',
    'CREATE UNIQUE INDEX "x" ON "t"(lower("c"));',
    'CREATE UNIQUE INDEX "x" ON "t"("c") WHERE "c" IS NOT NULL;',
  ]) assert.equal(uniqueIndexMigration(sql), null, sql);
});

test("duplicate checks look at complete groups only and quote every identifier", async () => {
  const [index] = uniqueIndexMigration(compound)!;
  assert.equal(duplicateQuery("public", index), 'SELECT 1 FROM "public"."ubicaciones_municipio" WHERE "estado_id" IS NOT NULL AND "codigo" IS NOT NULL GROUP BY "estado_id", "codigo" HAVING count(*) > 1 LIMIT 1');
  assert.match(duplicateQuery('we"ird', { name: "x", table: 't"x', columns: ["c"] }), /^SELECT 1 FROM "we""ird"\."t""x"/);
  const client = (rows: unknown[]) => ({ query: async () => ({ rows }) }) as never;
  await assert.doesNotReject(assertNoUniqueDuplicates(client([]), "public", [index]));
  await assert.rejects(assertNoUniqueDuplicates(client([{ "?column?": 1 }]), "public", [index]), /ubicaciones_municipio\(estado_id, codigo\): existen valores duplicados/);
  const prepared = uniqueIndexMigrationSQL(compound.replaceAll("\n", "\r\n"), [index]);
  assert.match(prepared, /^-- lite-erp: unique indexes prepared by orm:sync/);
  assert.ok(prepared.endsWith('("estado_id", "codigo");\n') && !prepared.includes("\r"));
});
