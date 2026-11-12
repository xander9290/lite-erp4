import { recordFields,recordReactionRules,recordReadFields } from "./record.schema";
import { onchangeRecord } from "../actions/record.actions";
export const recordUI = { fields: recordFields, readFields: recordReadFields, reactions:{rules:recordReactionRules,load:onchangeRecord} };
