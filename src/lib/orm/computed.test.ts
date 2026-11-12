import assert from "node:assert/strict";
import test from "node:test";
import { Fields,Model,defineModel,depends,onchange,type ModelInput,type ReactionValues } from "./index";
import type { ReactionContext } from "./reactions";
import { generateModule } from "./generator/generate";

const context={tx:{},actor:{id:"test",sessionVersion:1}} as ReactionContext;
class Invoice extends Model {
  quantity=Fields.Integer({required:true});
  price=Fields.Integer({required:true});
  total=Fields.Integer({compute:"computeTotal",required:true,label:"Total"});
  @depends("quantity","price")
  computeTotal(values:ReactionValues) { return Number(values.quantity??0)*Number(values.price??0); }
}
const model=defineModel(Invoice,{name:"ComputeInvoice",table:"compute_invoices"});

test("virtual compute infers dependencies and never enters persistence, defaults or capture types",async()=>{
  const input:ModelInput<typeof model>={quantity:2,price:30};
  assert.deepEqual(Object.keys(model.fields),["quantity","price"]);
  assert.deepEqual(Object.keys(model.createDefaults()),["quantity","price"]);
  assert.equal(model.schema.safeParse({...input,total:1}).success,false);
  // @ts-expect-error virtual values cannot be assigned to the persisted input contract
  const forged:ModelInput<typeof model>={...input,total:1};
  assert.ok(forged);
  assert.deepEqual(model.reactionRules,[{fields:["quantity","price"],reads:["quantity","price"],writes:[],preview:["total"]}]);
  assert.deepEqual(await model.react("price",input,context),{patch:{},preview:{total:60}});
  assert.deepEqual(await model.react("quantity",{quantity:null,price:30},context),{patch:{},preview:{total:0}});
  await assert.rejects(model.react("price",{...input,total:1},context),/no permitidos/);
  const files=generateModule({id:"computed",depends:[],models:[{model,clientFields:["quantity","price"]}]},{schema:'datasource db {\n provider = "postgresql"\n}\nmodel User {\n id String @id\n}',owners:{}});
  assert.doesNotMatch(files["models.prisma"],/\btotal\b/);
  assert.match(files["ComputeInvoice.schema.ts"],/PreviewFields[\s\S]*total/);
  assert.doesNotMatch(files["ComputeInvoice.schema.ts"],/computeTotal/);
});

test("computed methods are inherited, bounded and validate every result in backend",async()=>{
  class Invalid extends Invoice {@depends("quantity","price") computeTotal(){return 1.5;}}
  await assert.rejects(defineModel(Invalid,{name:"BadInvoice",table:"bad_invoices"}).react("price",{quantity:1,price:2},context));
  class Inherited extends Invoice {}
  assert.deepEqual(defineModel(Inherited,{name:"ChildInvoice",table:"child_invoices"}).reactionRules,model.reactionRules);
  class NoDependency extends Model {quantity=Fields.Integer();total=Fields.Integer({compute:"missing"});}
  assert.throws(()=>defineModel(NoDependency,{name:"NoDependency",table:"no_dependency"}),/@depends/);
  class Private extends Model {
    secret=Fields.Integer({sensitive:true});
    total=Fields.Integer({compute:"getTotal"});
    @depends("secret") getTotal(){return 1;}
  }
  assert.throws(()=>defineModel(Private,{name:"PrivateCompute",table:"private_compute"}),/inválido/);
  class Circular extends Model {
    quantity=Fields.Integer();total=Fields.Integer({compute:"getTotal"});
    @depends("total") getTotal(){return 1;}
  }
  assert.throws(()=>defineModel(Circular,{name:"CircularCompute",table:"circular_compute"}),/inválido/);
});

test("one compute method may return multiple declared outputs, with no omissions or extra keys",async()=>{
  class Labels extends Model {
    name=Fields.Text();
    first=Fields.Text({compute:"labels"});second=Fields.Text({compute:"labels"});
    @depends({fields:["name"]}) labels(values:ReactionValues){return {first:String(values.name),second:"Second"};}
  }
  const make=(cls:new()=>Labels)=>defineModel(cls,{name:"ComputedLabels",table:"computed_labels"});
  assert.deepEqual(await make(Labels).react("name",{name:"A"},context),{patch:{},preview:{first:"A",second:"Second"}});
  class Missing extends Labels {@depends("name") labels(){return {first:"A"} as {first:string;second:string};}}
  await assert.rejects(make(Missing).react("name",{name:"A"},context),/todos sus campos/);
});

test("virtual options fail early for conflicting storage and unsafe method names",()=>{
  for(const options of [{compute:"__proto__"},{compute:"foo",tracking:true},{compute:"foo",default:0},{compute:"foo",unique:true},{compute:"foo",sensitive:true}]) assert.throws(()=>Fields.Integer(options));
  assert.throws(()=>Fields.Image({compute:"foo",related:"modelId.avatar"}),/virtual/);
  class Mutating extends Invoice {
    onchange=[{method:"computeTotal",fields:["quantity"],writes:["price"]}];
  }
  assert.throws(()=>defineModel(Mutating,{name:"MutationCompute",table:"mutation_compute"}),/sin writes/);
});

test("active virtual methods consume validated onchange patches without a client cascade",async()=>{
  class Code extends Model {
    name=Fields.Text();label=Fields.Text({compute:"computeLabel"});
    @depends("name") computeLabel(values:ReactionValues){return values.name;}
    @onchange({fields:["name"],writes:["name"]}) uppercase(values:ReactionValues){return {name:String(values.name).toUpperCase()};}
  }
  const code=defineModel(Code,{name:"ComputedCode",table:"computed_code"});
  assert.deepEqual(await code.react("name",{name:"abc"},context),{patch:{name:"ABC"},preview:{label:"ABC"}});
});
