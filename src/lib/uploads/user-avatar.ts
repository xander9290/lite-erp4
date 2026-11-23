import { createCloudinaryImageUploader } from "./cloudinary";

export const uploadUserAvatar = createCloudinaryImageUploader({
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "",
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "",
  // Preserve the existing upload destination; the database retirement does not move assets.
  folder: "lite-erp/partners",
});
