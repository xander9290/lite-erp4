import { recordFields,recordReactionRules,recordReadFields } from "./vehicle.schema";
import { onchangeRecord } from "../actions/vehicle.actions";
import { lookupRecords as lookupName } from "@/app/(auth)/erp/flota/actions/modelo.actions";
export const recordUI = { fields: recordFields, readFields: recordReadFields, reactions:{rules:recordReactionRules,load:onchangeRecord}, lookups: { name: lookupName } };
