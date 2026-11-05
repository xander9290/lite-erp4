import { publicImageUrl } from "./form/imageProcessing";

export function partnerInitials(name: string) {
  const words = name.trim().split(/\s+/u).map(word => word.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
  if (!words.length) return "?";
  return [words[0], ...(words.length > 1 ? [words[words.length - 1]] : [])]
    .map(word => Array.from(word)[0]).join("").toLocaleUpperCase("es-MX");
}

export function partnerAvatarSource(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try { return publicImageUrl(value); } catch { return null; }
}
