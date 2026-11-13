export function safeErpRedirect(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return "/erp";
  try {
    const url = new URL(value, "https://erp.local");
    if (url.origin !== "https://erp.local" || !(url.pathname === "/erp" || url.pathname.startsWith("/erp/"))) return "/erp";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/erp"; }
}

export class AccessError extends Error {
  constructor(readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "DENIED") {
    super(code === "UNAUTHENTICATED" ? "Tu sesión no está activa. Inicia sesión nuevamente." : code === "DENIED" ? "No tienes permiso para esta operación." : "Necesitas permisos de administrador.");
  }
}

export function assertUserChange(actorId: string, target: { id: string; active: boolean; isAdmin: boolean }, next: { active: boolean; isAdmin: boolean }, activeAdmins: number) {
  if (target.id === actorId && (!next.active || !next.isAdmin)) return "No puedes desactivar tu propia cuenta ni quitarte los permisos de administrador.";
  if (target.active && target.isAdmin && (!next.active || !next.isAdmin) && activeAdmins <= 1) return "Debe existir al menos un administrador activo.";
  return null;
}
