"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { loginSchema } from "@/schemas/login.schema";

export async function loginAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa tu usuario y contraseña." };
  try {
    await signIn("credentials", { ...parsed.data, redirect: false, redirectTo: "/erp" });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof AuthError && error.type === "CredentialsSignin" ? "Usuario o contraseña incorrectos, o cuenta no disponible. Intenta nuevamente." : "No pudimos iniciar sesión. Intenta nuevamente." };
  }
}
export async function logoutAction() { await signOut({ redirect: false }); }
