import {
  recordFields,
  recordReactionRules,
  recordReadFields,
} from "./fabricante.schema";
import { onchangeRecord } from "../actions/fabricante.actions";
import { imageUploads } from "@/generated/orm/uploads/flota/FlotaFabricante.images";

export const recordUI = {
  fields: recordFields,
  readFields: recordReadFields,
  reactions: { rules: recordReactionRules, load: onchangeRecord },
  lookups: {},
  uploads: imageUploads,
};
