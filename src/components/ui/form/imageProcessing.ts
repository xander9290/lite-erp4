import type { ImageOutputType, ImageSelection, ImageSize } from "./image.types";
import { imageUrlSchema } from "@/lib/uploads/image-policy";

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const MAX_IMAGE_DIMENSION = 4096;
export const MAX_SOURCE_PIXELS = 40_000_000;

export function validateImageFile(file: Pick<File, "type" | "size">, maxSizeMB: number) {
  if (!Number.isFinite(maxSizeMB) || maxSizeMB <= 0) throw new RangeError("maxSizeMB debe ser mayor que cero.");
  if (!IMAGE_ACCEPT.split(",").includes(file.type)) throw new Error("Selecciona una imagen JPEG, PNG o WebP.");
  if (file.size <= 0 || file.size > maxSizeMB * 1024 * 1024) throw new Error(`La imagen debe pesar entre 1 byte y ${maxSizeMB} MB.`);
}

export function validateImageSize({ width, height }: ImageSize) {
  if (![width, height].every(value => Number.isInteger(value) && value > 0) || width * height > MAX_SOURCE_PIXELS) {
    throw new Error("La imagen no es válida o supera los 40 megapíxeles.");
  }
}

export function initialImageCrop({ width, height }: ImageSize, aspect?: number): ImageSelection {
  validateImageSize({ width, height });
  if (aspect !== undefined && (!Number.isFinite(aspect) || aspect <= 0)) throw new RangeError("aspectRatio debe ser mayor que cero.");
  const cropWidth = aspect ? Math.min(width, height * aspect) : width;
  const cropHeight = aspect ? cropWidth / aspect : height;
  return { unit: "%", x: (1 - cropWidth / width) * 50, y: (1 - cropHeight / height) * 50, width: cropWidth / width * 100, height: cropHeight / height * 100 };
}

export function imageCropPixels(crop: ImageSelection, source: ImageSize) {
  validateImageSize(source);
  if (![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 100.001 || crop.y + crop.height > 100.001) {
    throw new Error("Selecciona un área válida para recortar.");
  }
  const x = Math.min(source.width - 1, Math.round(crop.x / 100 * source.width));
  const y = Math.min(source.height - 1, Math.round(crop.y / 100 * source.height));
  return { x, y, width: Math.max(1, Math.min(source.width - x, Math.round(crop.width / 100 * source.width))), height: Math.max(1, Math.min(source.height - y, Math.round(crop.height / 100 * source.height))) };
}

export function fitImageSize(size: ImageSize): ImageSize {
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / size.width, MAX_IMAGE_DIMENSION / size.height);
  return { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) };
}

export function publicImageUrl(value: unknown): string {
  const result = imageUrlSchema().safeParse(typeof value === "string" ? value.trim() : value);
  if (!result.success) throw new Error("El servidor debe devolver una URL HTTPS válida, sin credenciales y de hasta 2048 caracteres.");
  return new URL(result.data).href;
}

export function loadImage(source: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const cleanup = () => { signal.removeEventListener("abort", abort); image.onload = null; image.onerror = null; };
    const abort = () => { cleanup(); image.src = ""; reject(new DOMException("Operación cancelada", "AbortError")); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = () => { cleanup(); reject(new Error("No se pudo leer la imagen. Usa un JPEG, PNG o WebP válido.")); };
    image.src = source;
  });
}

export async function exportImage({ source, crop, size, type, quality, filename, signal }: {
  source: string; crop: ImageSelection; size: ImageSize; type: ImageOutputType; quality: number; filename: string; signal: AbortSignal;
}): Promise<File> {
  if (![size.width, size.height].every(value => Number.isInteger(value) && value >= 1 && value <= MAX_IMAGE_DIMENSION)) throw new Error("El ancho y alto deben ser enteros entre 1 y 4096 píxeles.");
  if (!Number.isFinite(quality) || quality < 0.1 || quality > 1) throw new Error("La calidad debe estar entre 10% y 100%.");
  const image = await loadImage(source, signal);
  const pixels = imageCropPixels(crop, { width: image.naturalWidth, height: image.naturalHeight });
  if (size.width > pixels.width || size.height > pixels.height) throw new Error("Las dimensiones no pueden superar el tamaño del recorte original.");
  const canvas = document.createElement("canvas");
  canvas.width = size.width; canvas.height = size.height;
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no permite procesar la imagen.");
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
    if (type === "image/jpeg") { context.fillStyle = "#ffffff"; context.fillRect(0, 0, size.width, size.height); }
    context.drawImage(image, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("No se pudo generar la imagen.")), type, quality));
    if (signal.aborted) throw new DOMException("Operación cancelada", "AbortError");
    const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
    const stem = filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "imagen";
    return new File([blob], `${stem}-${size.width}x${size.height}.${extension}`, { type: blob.type });
  } finally { canvas.width = 0; canvas.height = 0; }
}
