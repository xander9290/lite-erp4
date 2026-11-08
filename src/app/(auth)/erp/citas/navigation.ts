/** Only this module's list can be a return destination; URL parameters are untrusted. */
export function appointmentReturnHref(value: unknown) {
  if (typeof value !== "string" || value.length > 20000 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return "/erp/citas";
  try {
    const url = new URL(value, "https://erp.local");
    return url.origin === "https://erp.local" && url.pathname === "/erp/citas" ? `${url.pathname}${url.search}` : "/erp/citas";
  } catch { return "/erp/citas"; }
}
