import assert from "node:assert/strict";
import test from "node:test";
import { assertAdditiveEvolution } from "./evolution";
import { checkQueries, forcedMigrationSQL, validateForceData } from "./force";
import { assertSyncSQL } from "./sync";
import type { Client } from "pg";
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
