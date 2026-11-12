import { onchangeRecord } from "../actions/modelo.actions";
import { recordFields,recordReactionRules } from "./modelo.schema";
import { lookupRecords } from "../actions/fabricante.actions";
export const recordUI = { fields: recordFields, reactions:{rules:recordReactionRules,load:onchangeRecord}, lookups: { fabricanteId: lookupRecords } };
