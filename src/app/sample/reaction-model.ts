import "server-only";
import { Fields,Model,defineModel,depends,constraint,ModelValidationError,type ReactionValues } from "@/lib/orm";
import { sampleReactionFields } from "./reaction-contract";
class SampleReaction extends Model {
  name=sampleReactionFields.name;
  quantity=sampleReactionFields.quantity;
  unitPrice=sampleReactionFields.unitPrice;
  total=Fields.Integer({label:"Total calculado",required:true,compute:"computeTotal"});
  description=Fields.Text({label:"Resumen",compute:"computeDescription"});
  readonly onchange=[{method:"upper",fields:["name"],writes:["name"]}];
  upper(values:ReactionValues){return {name:typeof values.name==="string"?values.name.toUpperCase():null};}
  @depends("quantity","unitPrice")
  computeTotal(values:ReactionValues){return Number(values.quantity??0)*Number(values.unitPrice??0);}
  @depends("name","quantity")
  computeDescription(values:ReactionValues){return `${values.name??"Sin código"} · ${values.quantity??0} unidades`;}
  @constraint("quantity","unitPrice")
  validateTotal(values:ReactionValues){if(Number(values.quantity)*Number(values.unitPrice)>100000)throw new ModelValidationError("El total del ejemplo no puede superar 100000.",{quantity:"Reduce la cantidad."});}
}
export const sampleReactionModel=defineModel(SampleReaction,{name:"SampleReaction",table:"sample_reaction"});
