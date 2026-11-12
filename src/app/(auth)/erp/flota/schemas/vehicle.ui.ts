import { onchangeRecord } from "../actions/vehicle.actions";
import { recordFields,recordReactionRules } from "./vehicle.schema";
import { lookupRecords as lookupName } from "@/app/(auth)/erp/flota/actions/modelo.actions";
export const recordUI = { fields: recordFields, reactions:{rules:recordReactionRules,load:onchangeRecord}, lookups: { name: lookupName } };
