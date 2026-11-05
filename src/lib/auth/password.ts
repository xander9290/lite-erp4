import { compare, hash } from "bcryptjs";

export function passwordBytes(value: string) { return new TextEncoder().encode(value).length; }
export async function hashPassword(value: string) {
  if (!value || passwordBytes(value) > 72) throw new Error("La contraseña debe contener entre 1 y 72 bytes.");
  return hash(value, 12);
}
export async function verifyPassword(value: string, encoded: string) {
  if (!value || passwordBytes(value) > 72 || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(encoded)) return false;
  return compare(value, encoded);
}
