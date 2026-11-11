import { z } from "zod";

export const IMAGE_URL_MAX_LENGTH = 2048;

/** Shared browser/server scalar validation; does not fetch or inspect remote content. */
export function imageUrlSchema(label = "Imagen", maxLength = IMAGE_URL_MAX_LENGTH) {
  return z.url({ protocol: /^https$/, error: `${label}: usa una URL HTTPS válida.` })
    .max(maxLength, `${label}: máximo ${maxLength} caracteres.`)
    .refine(value => { try { const url = new URL(value); return !url.username && !url.password; } catch { return false; } }, `${label}: la URL no puede incluir credenciales.`);
}

export function validateImageFolder(folder: unknown): string {
  if (typeof folder !== "string" || folder.length > 200 || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(folder)) {
    throw new Error("Image necesita folder: segmentos de letras, números, guiones o guiones bajos separados por / (máximo 200 caracteres).");
  }
  return folder;
}
