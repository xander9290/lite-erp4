import { recordFields,recordReactionRules,recordReadFields } from "./modelo.schema";
import { onchangeRecord } from "../actions/modelo.actions";
import { lookupRecords as lookupFabricanteId } from "@/app/(auth)/erp/flota/actions/fabricante.actions";
export const recordUI = { fields: recordFields, readFields: recordReadFields, reactions:{rules:recordReactionRules,load:onchangeRecord}, lookups: { fabricanteId: lookupFabricanteId } };
