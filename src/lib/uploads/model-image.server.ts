import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { FieldMetadata } from "../orm/fields";
import { validateImageFolder } from "./image-policy";
import { AccessError } from "../auth/policy";
import type { CloudinaryImageSignature, CloudinaryImageSignatureResult } from "./cloudinary-signature";
import { cloudinaryServerConfig, type CloudinaryServerConfig } from "./config.server";

type ImageModel = { readonly metadata: Readonly<Record<string, FieldMetadata>> };
class ImageUploadError extends Error {}

/** Bind a trusted declaration/publication boundary once; authorize every request before issuing a capability. */
export function createModelImageSigner(
  { authorize, getConfig = cloudinaryServerConfig }: { authorize: () => Promise<unknown>; getConfig?: () => CloudinaryServerConfig },
  model: ImageModel,
  clientFields: readonly string[],
) {
  const folders = new Map(clientFields.flatMap(name => {
    const field = Object.hasOwn(model.metadata, name) ? model.metadata[name] : undefined;
    return field?.kind === "image" && !field.sensitive ? [[name, validateImageFolder(field.folder)] as const] : [];
  }));
  return async (name: unknown): Promise<CloudinaryImageSignatureResult> => {
    try {
      await authorize();
      const folder = typeof name === "string" ? folders.get(name) : undefined;
      if (!folder) throw new ImageUploadError("El campo de imagen no está habilitado para subidas.");
      const { cloudName, apiKey, apiSecret, folderMode = "dynamic", uploadPreset } = getConfig();
      if (!/^[\w-]+$/.test(cloudName) || !/^\d+$/.test(apiKey) || !apiSecret.trim()) {
        throw new ImageUploadError("Configura CLOUDINARY_CLOUD_NAME (o NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME), CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en el servidor para subir imágenes de modelos.");
      }
      if (folderMode !== "dynamic" && folderMode !== "fixed") throw new ImageUploadError("CLOUDINARY_FOLDER_MODE debe ser dynamic o fixed.");
      if (uploadPreset !== undefined && !/^[\w-]+$/.test(uploadPreset)) throw new ImageUploadError("CLOUDINARY_SIGNED_UPLOAD_PRESET debe ser un nombre de preset válido.");
      const parameters: CloudinaryImageSignature["parameters"] = {
        ...(folderMode === "fixed" ? { folder } : { asset_folder: folder }),
        timestamp: String(Math.floor(Date.now() / 1000)), public_id: randomUUID(), overwrite: "false", allowed_formats: "jpg,png,webp",
        ...(uploadPreset ? { upload_preset: uploadPreset } : {}),
      };
      const payload = Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&");
      const signature = createHash("sha256").update(payload + apiSecret).digest("hex");
      return { ok: true, data: { cloudName, apiKey, parameters, signature } };
    } catch (error) {
      return { ok: false, error: error instanceof ImageUploadError || error instanceof AccessError ? error.message : "No se pudo autorizar la subida de imagen. Intenta nuevamente." };
    }
  };
}
