import assert from "node:assert/strict";
import test from "node:test";
import { assertAdditiveEvolution } from "./evolution";
import { checkQueries, forceChecks, forcedMigrationSQL, validateForceData } from "./force";
import { assertSyncSQL } from "./sync";
import type { Client } from "pg";
import { Fields } from "../fields";
import { Model, defineModel } from "../model";
const schema=(line:string)=>`model Vehicle {\n id String @id\n ${line}\n @@map("vehicles")\n}`;
test("force accepts reviewed String constraints while normal evolution remains strict",()=>{
  const before=schema("plate String?");
  for(const field of ['plate String? @unique @db.VarChar(20)','plate String @db.VarChar(20)','plate String? @unique']) {
    assert.throws(()=>assertAdditiveEvolution(before,schema(field)),/--force/);
    assert.doesNotThrow(()=>assertAdditiveEvolution(before,schema(field),true));
  }
  assert.doesNotThrow(()=>assertAdditiveEvolution(schema('plate String? @db.VarChar(80)'),schema('plate String? @db.VarChar(20)'),true));
  for(const after of [schema('registration String?'),schema('plate Int?'),schema('plate String? @map("other")'),schema('plate String? @default("changed")'),schema('')]) assert.throws(()=>assertAdditiveEvolution(before,after,true));
  assert.throws(()=>assertAdditiveEvolution(schema('plate String? @unique'),before,true));
  assert.throws(()=>assertAdditiveEvolution(before,'',true),/eliminar/);
});
const check={table:'vehicles',field:'plate',model:'Vehicle',maxLength:20,unique:true,required:true};
test("force SQL rechecks data under a write lock and preserves strict destructive SQL rejection",()=>{
  const sql=forcedMigrationSQL('ALTER TABLE "vehicles" ALTER COLUMN "plate" SET DATA TYPE VARCHAR(20);',[check]);
  assert.match(sql,/BEGIN;[\s\S]*LOCK TABLE[\s\S]*char_length[\s\S]*GROUP BY[\s\S]*IS NULL[\s\S]*ALTER TABLE[\s\S]*COMMIT;/);
  assert.match(sql,/END;\n\$lite_erp_force\$/);
  assert.doesNotThrow(()=>assertSyncSQL(sql));
  assert.throws(()=>assertSyncSQL(forcedMigrationSQL('DROP TABLE vehicles;',[check])),/manual/);
  assert.match(checkQueries({...check,field:'a"b'})[0].sql,/"a""b"/);
});
test("data preflight rejects long values, duplicates and nulls without exposing row contents",async()=>{
  for(const failure of ["char_length", "GROUP BY", "IS NULL"]) {
    const client={query:async(sql:string)=>({rows:sql.includes("information_schema.columns")?[{table_name:"vehicles",column_name:"plate",data_type:"text"}]:sql.includes(failure)?[{exists:1}]:[]})} as unknown as Client;
    await assert.rejects(validateForceData(client,"custom",[check]),/Vehicle.plate:/);
  }
  const client={query:async(sql:string)=>({rows:sql.includes("information_schema.columns")?[{table_name:"vehicles",column_name:"plate",data_type:"text"}]:[]})} as unknown as Client;
  assert.deepEqual(await validateForceData(client,"custom",[check]),[check]);
  assert.deepEqual(await validateForceData(client,"custom",[{...check,field:"newField"}]),[]);
});

const relationSchema = (optional: boolean, foreignOptional = optional) => `model Partner {
 id String @id
 emails Mail[] @relation("MailPartner")
}
model Mail {
 id String @id
 partnerId String${foreignOptional ? "?" : ""} @map("partner_id")
 partner Partner${optional ? "?" : ""} @relation("MailPartner", fields: [partnerId], references: [id], onDelete: Restrict)
 @@map("mails")
}`;

test("force changes an owning relation only with the matching FK nullability", () => {
  for (const [before, after] of [[relationSchema(true), relationSchema(false)], [relationSchema(false), relationSchema(true)]]) {
    assert.throws(() => assertAdditiveEvolution(before, after), /--force/);
    assert.doesNotThrow(() => assertAdditiveEvolution(before, after, true));
  }
  const before = relationSchema(true), after = relationSchema(false);
  for (const invalid of [
    relationSchema(false, true), relationSchema(true, false),
    after.replace('partner_id', 'different_column'),
    after.replace('partner Partner ', 'renamed Partner '),
    after.replace('MailPartner', 'ChangedRelation'),
    after.replace('onDelete: Restrict', 'onDelete: Cascade'),
    after.replace('onDelete: Restrict', 'onDelete: SetNull'),
    after.replace(', onDelete: Restrict', ''),
    after.replace('references: [id]', 'references: [otherId]'),
    after.replace('fields: [partnerId]', 'fields: [otherId]'),
    after.replace('partnerId String ', 'partnerId Int '),
    after.replace('partner Partner ', 'partner Other '),
    after.replace('partnerId String @map', 'partnerId String @default("new") @map'),
    after.replace('emails Mail[]', 'emails Mail?'),
  ]) assert.throws(() => assertAdditiveEvolution(before, invalid, true));
});

test("force data checks and locked SQL use the physical mapped Many2one column", async () => {
  const model = defineModel(class extends Model {
    partnerId = Fields.Many2one("Partner", { required: true });
  }, { name: "Mail", table: "mails" });
  const checks = forceChecks({ module: { id: "mail", depends: [], models: [{ model, clientFields: ["partnerId"] }] }, externalOwners: {} });
  assert.equal(checks[0].field, "partnerId");
  assert.equal(checks[0].column, "partner_id");
  const queries: string[] = [];
  let hasNull = false;
  const client = { query: async (sql: string) => {
    if (sql.includes("information_schema.columns")) return { rows: [{ table_name: "mails", column_name: "partner_id", data_type: "text" }] };
    queries.push(sql);
    return { rows: hasNull ? [{ exists: 1 }] : [] };
  } } as unknown as Client;
  assert.deepEqual(await validateForceData(client, "public", checks), checks);
  assert.match(queries[0], /"public"\."mails" WHERE "partner_id" IS NULL/);
  hasNull = true;
  await assert.rejects(validateForceData(client, "public", checks), /Mail.partnerId: existen valores nulos/);
  const sql = forcedMigrationSQL('ALTER TABLE "mails" ALTER COLUMN "partner_id" SET NOT NULL;', checks);
  assert.match(sql, /WHERE "partner_id" IS NULL/);
  assert.doesNotThrow(() => assertSyncSQL(sql));
});
