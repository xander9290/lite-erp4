import { Fields } from "@/lib/orm/fields";
import { z } from "zod";
export const sampleReactionFields={
  name:Fields.Text({label:"Código",maxLength:30}),
  quantity:Fields.Integer({label:"Cantidad",required:true,min:0,max:1000,default:1}),
  unitPrice:Fields.Integer({label:"Precio",required:true,min:0,max:1000000,default:10}),
};
export const sampleReactionSchema=z.object({name:sampleReactionFields.name.schema,quantity:sampleReactionFields.quantity.schema,unitPrice:sampleReactionFields.unitPrice.schema});
export type SampleReactionInput=z.input<typeof sampleReactionSchema>;
export type SampleReactionValues=z.output<typeof sampleReactionSchema>;
