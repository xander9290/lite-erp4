import { onchangeRecord } from "../actions/record.actions";
import { recordFields,recordReactionRules } from "./record.schema";
export const recordUI = { fields: recordFields, reactions:{rules:recordReactionRules,load:onchangeRecord} };
