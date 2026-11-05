import { createCloudinaryImageUploader } from "./cloudinary";

export const uploadPartnerAvatar = createCloudinaryImageUploader({
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "",
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "",
  folder: "lite-erp/partners",
});
