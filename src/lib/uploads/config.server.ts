import "server-only";

export type CloudinaryServerConfig = { cloudName: string; apiKey: string; apiSecret: string; folderMode?: string; uploadPreset?: string };

export function cloudinaryServerConfig(): CloudinaryServerConfig {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
    folderMode: process.env.CLOUDINARY_FOLDER_MODE ?? "dynamic",
    uploadPreset: process.env.CLOUDINARY_SIGNED_UPLOAD_PRESET,
  };
}
