import { onchangeRecord } from "../actions/fabricante.actions";
import { recordFields,recordReactionRules } from "./fabricante.schema";
import { imageUploads } from "@/generated/orm/uploads/flota/FlotaFabricante.images";
export const recordUI = { fields: recordFields, reactions:{rules:recordReactionRules,load:onchangeRecord}, uploads: imageUploads };
