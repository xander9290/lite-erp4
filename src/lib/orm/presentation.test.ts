import assert from "node:assert/strict";
import test from "node:test";
import { Fields } from "./fields";
import { Model, defineModel } from "./model";
import { modelColumns } from "./presentation";
import { withDisplayName } from "./typed-display";

test("published descriptors derive columns and preserve explicit presentation", () => {
  const fields = { state:Fields.Selection([{value:"draft",label:"Borrador"}],{label:"Estado",required:true}), ownerId:Fields.Many2one("Owner"), photo:Fields.Image({folder:"demo"}), secret:Fields.Text({sensitive:true}) };
  const columns = modelColumns(fields,[{field:"state"},{field:"ownerId",label:"Responsable",groupable:true},{field:"photo",imageShape:"squared"}]);
  assert.deepEqual(columns[0].options,[{value:"draft",label:"Borrador"}]);
  assert.equal(columns[1].widget,"many2one"); assert.equal(columns[1].label,"Responsable");
  assert.equal(columns[2].widget,"image"); assert.equal(columns[2].imageShape,"squared");
  assert.throws(()=>modelColumns(fields,[{field:"secret"}]),/sensible/);
  assert.throws(()=>modelColumns(fields,[{field:"missing" as "state"}]),/no publicado/);
});

const brand = defineModel(class extends Model { name=Fields.Text({required:true}); privateName=Fields.Text({sensitive:true}); },{name:"DisplayBrand",table:"display_brand"});
const vehicle = defineModel(class extends Model { name=Fields.Text({required:true}); brandId=Fields.Many2one("DisplayBrand"); },{name:"DisplayVehicle",table:"display_vehicle"});
test("typed names project dependencies, preserve nullable relations and reject target mismatches", () => {
  const model = withDisplayName(vehicle,{brand},["name","brand.name"],record=>{
    const name:string=record.name;
    const label:string|undefined=record.brand?.name;
    // @ts-expect-error fields outside the projection are not visible to the callback.
    void record.brand?.privateName;
    return [label,name].filter(Boolean).join(" · ");
  });
  assert.equal(model.displayName({id:"1",name:"Modelo",brand:{name:"Marca",privateName:"hidden"}}),"Marca · Modelo");
  assert.equal(model.displayName({id:"1",name:"Modelo",brand:null}),"Modelo");
  const other = defineModel(class extends Model {name=Fields.Text();},{name:"OtherBrand",table:"other_brand"});
  assert.throws(()=>withDisplayName(vehicle,{brand:other},["name"],record=>record.name),/Destino/);
  assert.throws(()=>withDisplayName(vehicle,{brand},["brand.privateName"],()=>"bad"),/inválida/);
});
if (false) {
  // @ts-expect-error invalid route rejected at compile time.
  withDisplayName(vehicle,{brand},["brand.unknown"],()=>"");
  // @ts-expect-error unknown relation alias rejected at compile time.
  withDisplayName(vehicle,{missing:brand},["name"],()=>"");
}

test("typed display dependencies traverse declared intermediate relations without exposing other fields",()=>{
  const country=defineModel(class extends Model {name=Fields.Text({required:true});},{name:"DisplayCountry",table:"display_country"});
  const base=defineModel(class extends Model {name=Fields.Text({required:true});countryId=Fields.Many2one("DisplayCountry",{required:true});},{name:"DisplayBrand",table:"display_brand"});
  const related=withDisplayName(base,{country},["country.name"],row=>row.country.name);
  const model=withDisplayName(vehicle,{brand:related},["brand.country.name"],row=>{
    const label:string|undefined=row.brand?.country.name;
    return label??"Sin país";
  });
  assert.equal(model.displayName({id:"1",brand:{name:"Hidden",country:{name:"México"}}}),"México");
  assert.equal(model.displayName({id:"1",brand:null}),"Sin país");
});
