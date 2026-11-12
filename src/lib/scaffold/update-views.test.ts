import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { Fields } from "../orm/fields";
import { planViewUpdates } from "./update-views";
const sources={
  form:'"use client";\nimport FieldText from "@/components/ui/form/FieldText";\nfunction Editor(){return <FormView model={recordUI}><FormGroup><FieldText name="name" label="Mi etiqueta" /></FormGroup></FormView>}',
  list:'function View(){return <ListView fields={recordFields}><ListView.Field name="name" label="Mi columna" /></ListView>}',
  service:'export const recordService=createModelService(model,repo,{list:{fields:["name"],searchFields:["name"],sortable:[],filterable:["name"],groupable:[]}});',
  ui:'export const recordUI={fields:recordFields,lookups:{}};',
};
const fields={name:Fields.Text().metadata,active:Fields.Boolean().metadata};
test("view proposals add missing controls/columns/policy without replacing custom code and are idempotent",()=>{
  const result=planViewUpdates(sources,fields);
  assert.match(result.form!,/label="Mi etiqueta"/);assert.match(result.form!,/FieldBoolean<RecordInput> name="active"/);
  assert.match(result.form!,/import FieldBoolean from/);assert.match(result.list!,/label="Mi columna"/);
  assert.match(result.service,/sortable:\[\s*"active",?\s*\]/); // Existing intentional absence of name sorting is preserved.
  const file=ts.createSourceFile("view.tsx",result.form!,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  assert.equal((file as ts.SourceFile & {parseDiagnostics:unknown[]}).parseDiagnostics.length,0);
  const again=planViewUpdates({...sources,...result},fields);
  assert.deepEqual(again,result);
});
test("ambiguous forms, dynamic columns and missing relation providers are rejected before writing",()=>{
  assert.throws(()=>planViewUpdates({...sources,form:sources.form.replace('</FormView>','<FormGroup /></FormView>')},fields));
  assert.throws(()=>planViewUpdates({...sources,list:sources.list.replace('name="name"','name={field}')},fields),/dinámica/);
  assert.throws(()=>planViewUpdates(sources,{...fields,ownerId:Fields.Many2one("Owner").metadata}));
  assert.throws(()=>planViewUpdates({...sources,form:sources.form.replace(' model={recordUI}','')},fields),/manual/);
});
