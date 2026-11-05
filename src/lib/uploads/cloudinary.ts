import type { ImageUploader } from "@/components/ui/form/image.types";

export type CloudinaryImageConfig = { cloudName: string; uploadPreset: string; folder?: string };

/** Unsigned browser upload. Signed uploads can provide another ImageUploader. Never pass an API Secret here. */
export function createCloudinaryImageUploader({ cloudName, uploadPreset, folder }: CloudinaryImageConfig): ImageUploader {
  return (file, { signal, onProgress }) => new Promise((resolve, reject) => {
    if (!/^[\w-]+$/.test(cloudName) || !uploadPreset.trim()) { reject(new Error("Configura el cloud name y un upload preset unsigned de Cloudinary.")); return; }
    if (signal.aborted) { reject(new DOMException("Subida cancelada", "AbortError")); return; }
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const cleanup = () => signal.removeEventListener("abort", abort);
    request.open("POST", `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`);
    request.responseType = "json";
    request.timeout = 90_000;
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.min(99, Math.round(event.loaded / event.total * 100))); };
    request.onload = () => {
      cleanup();
      const data = request.response;
      if (request.status < 200 || request.status >= 300) { reject(new Error(data?.error?.message || "Cloudinary no pudo guardar la imagen.")); return; }
      try {
        if (typeof data?.secure_url !== "string") throw new Error("Cloudinary no devolvió secure_url.");
        const url = new URL(data.secure_url);
        if (url.protocol !== "https:" || url.username || url.password) throw new Error("Cloudinary devolvió una URL no válida.");
        onProgress(100); resolve(url.href);
      } catch (error) { reject(error); }
    };
    request.onerror = () => { cleanup(); reject(new Error("No se pudo conectar con Cloudinary. Revisa tu conexión.")); };
    request.ontimeout = () => { cleanup(); reject(new Error("Cloudinary tardó demasiado. Intenta de nuevo.")); };
    request.onabort = () => { cleanup(); reject(new DOMException("Subida cancelada", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    const body = new FormData();
    body.append("file", file); body.append("upload_preset", uploadPreset.trim());
    if (folder?.trim()) body.append("folder", folder.trim());
    request.send(body);
  });
}
