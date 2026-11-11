import "server-only";
import { Model, defineModel } from "@/lib/orm";
import { imageSampleField } from "./sample.schema";

/** Demonstration declaration only. Never installed or persisted. */
export const sampleImageModel = defineModel(class extends Model {
  image = imageSampleField;
}, { name: "SampleImage", table: "sample_image" });
