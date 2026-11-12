import "server-only";
import { Model, defineModel } from "@/lib/orm";
import { relatedImageFields, relatedImageReadFields } from "./related-image.contract";

class DemoRelatedImage extends Model {
  modelId = relatedImageFields.modelId;
  photo = relatedImageReadFields.photo;
}
export const relatedImageModel = defineModel(DemoRelatedImage,{name:"DemoRelatedImage",table:"demo_related_image"});
