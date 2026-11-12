import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { useForm, FormProvider } from "react-hook-form";
import { Fields } from "@/lib/orm/fields";
import { FormModelContext, useModelField } from "./modelFields";
import FieldText from "./FieldText";
import FieldSelect from "./FieldSelect";
import FieldNumber from "./FieldNumber";
const fields={name:Fields.Text({label:"Nombre heredado",required:true,maxLength:12}),state:Fields.Selection([{value:"draft",label:"Borrador"}],{label:"Estado",required:true}),ownerId:Fields.Many2one("Owner")};
const load=async()=>({ok:false as const,error:"sample"});
function Probe(){const props=useModelField({name:"ownerId"},"many2one") as {load?:unknown};return <span>{props.load===load?"lookup heredado":"sin lookup"}</span>;}
function Fixture({override=false,bound=true}:{override?:boolean;bound?:boolean}) {
  const methods=useForm({defaultValues:{name:"",state:"draft"}});
  return <FormProvider {...methods}><FormModelContext.Provider value={bound?{fields,lookups:{ownerId:load}}:undefined}>
    <FieldText name="name" {...override?{label:"Personalizado",required:false,maxLength:30}:{}} />
    <FieldSelect name="state" {...!bound?{options:[{value:"draft",label:"Manual"}]}:{}} />
    <Probe />
  </FormModelContext.Provider></FormProvider>;
}
test("existing controls inherit metadata, explicit false/labels/limits override it, manual forms keep working",()=>{
  const inherited=renderToStaticMarkup(<Fixture />);
  assert.match(inherited,/Nombre heredado/);assert.match(inherited,/maxLength="12"/i);assert.match(inherited,/required=""/);assert.match(inherited,/Borrador/);assert.match(inherited,/lookup heredado/);assert.match(inherited,/autoComplete="off"/i);
  const overridden=renderToStaticMarkup(<Fixture override />);
  assert.match(overridden,/Personalizado/);assert.match(overridden,/maxLength="30"/i);
  assert.doesNotMatch(overridden.split('name="name"')[0],/required=""/);
  assert.match(renderToStaticMarkup(<Fixture bound={false} />),/Manual/);
});

test("Text and Number display consume readonly metadata without any form provider or editable inputs",()=>{
  const readFields={total:Fields.Integer({label:"Total calculado"}),summary:Fields.Text({label:"Resumen"})};
  const html=renderToStaticMarkup(<FormModelContext.Provider value={{fields:{},readFields,reactionState:{pending:false,error:null,preview:{total:1234,summary:"<script>texto literal</script>"}}}}>
    <FieldNumber mode="display" name="total" type="integer" direction="inline" />
    <FieldText mode="display" name="summary" />
  </FormModelContext.Provider>);
  assert.match(html,/Total calculado/);assert.match(html,/1,234/);
  assert.match(html,/&lt;script&gt;texto literal&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<input|<textarea|<script>/);
  assert.match(html,/data-form-field="total"/);
  assert.throws(()=>renderToStaticMarkup(<FormModelContext.Provider value={{fields:{},readFields}}><FieldText mode="display" name="missing" /></FormModelContext.Provider>),/no publicado/);
});
