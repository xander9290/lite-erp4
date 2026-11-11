import type { ImageUploader } from "@/components/ui/form/image.types";
import { publicImageUrl, validateImageFile } from "@/components/ui/form/imageProcessing";
import type { CloudinaryImageSignatureResult } from "./cloudinary-signature";
import { imageUploadDefaults } from "./config";

export type CloudinaryImageConfig = { cloudName: string; uploadPreset: string; folder?: string };

/** Unsigned browser upload. Signed uploads can provide another ImageUploader. Never pass an API Secret here. */
export function createCloudinaryImageUploader({ cloudName, uploadPreset, folder }: CloudinaryImageConfig): ImageUploader {
  return (file, options) => {
    if (!/^[\w-]+$/.test(cloudName) || !uploadPreset.trim()) return Promise.reject(new Error("Configura el cloud name y un upload preset unsigned de Cloudinary."));
    return uploadImage(cloudName, { upload_preset: uploadPreset.trim(), ...(folder?.trim() ? { folder: folder.trim() } : {}) }, file, options);
  };
}

/** The action supplies signed parameters fixed by the server, never a folder from browser input. */
export function createSignedCloudinaryImageUploader(sign: () => Promise<CloudinaryImageSignatureResult>): ImageUploader {
  return async (file, options) => {
    if (options.signal.aborted) throw new DOMException("Subida cancelada", "AbortError");
    validateImageFile(file, imageUploadDefaults.maxSizeMB);
    const result = await sign();
    if (options.signal.aborted) throw new DOMException("Subida cancelada", "AbortError");
    if (!result.ok) throw new Error(result.error);
    const signed = result.data;
    if (!/^[\w-]+$/.test(signed.cloudName) || !/^\d+$/.test(signed.apiKey) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(signed.signature)) throw new Error("Cloudinary devolvió una configuración de subida inválida.");
    const parameters: Record<string, string> = { api_key: signed.apiKey, signature: signed.signature };
    for (const [name, value] of Object.entries(signed.parameters)) if (value !== undefined) parameters[name] = value;
    return uploadImage(signed.cloudName, parameters, file, options);
  };
}

const uploadImage = (cloudName: string, parameters: Record<string, string>, file: File, { signal, onProgress }: Parameters<ImageUploader>[1]): ReturnType<ImageUploader> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Subida cancelada", "AbortError")); return; }
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const cleanup = () => signal.removeEventListener("abort", abort);
    request.open("POST", `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`);
    request.responseType = "json";
    request.timeout = 90_000;
    request.upload.onprogress = event => { if (!signal.aborted && event.lengthComputable) onProgress(Math.min(99, Math.round(event.loaded / event.total * 100))); };
    request.onload = () => {
      cleanup();
      if (signal.aborted) return;
      const data = request.response;
      if (request.status < 200 || request.status >= 300) { reject(new Error(data?.error?.message || "Cloudinary no pudo guardar la imagen.")); return; }
      try {
        const url = publicImageUrl(data?.secure_url);
        onProgress(100); resolve(url);
      } catch (error) { reject(error); }
    };
    request.onerror = () => { cleanup(); reject(new Error("No se pudo conectar con Cloudinary. Revisa tu conexión.")); };
    request.ontimeout = () => { cleanup(); reject(new Error("Cloudinary tardó demasiado. Intenta de nuevo.")); };
    request.onabort = () => { cleanup(); reject(new DOMException("Subida cancelada", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    const body = new FormData();
    body.append("file", file);
    for (const [name, value] of Object.entries(parameters)) body.append(name, value);
    request.send(body);
  });
