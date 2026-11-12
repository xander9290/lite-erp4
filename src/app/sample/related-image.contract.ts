import { Fields } from "@/lib/orm/fields";
import { z } from "zod";

export const relatedImageFields = { modelId: Fields.Many2one("DemoImageModel", {label:"Modelo",required:true}) };
export const relatedImageReadFields = { photo: Fields.Image({related:"modelId.makerId.avatar",label:"Imagen del fabricante"}) };
export const relatedImageSchema = z.strictObject({modelId:relatedImageFields.modelId.schema});
export type RelatedImageInput = z.input<typeof relatedImageSchema>;
export type RelatedImageValues = z.output<typeof relatedImageSchema>;
