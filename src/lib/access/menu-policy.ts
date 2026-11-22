/** Presentation only. Hiding a link never changes model permissions or direct URL access. */
export type HiddenMenu = { application: string; menu: string };
export const menuKey = (application: string, menu: string) => `${application}|${menu}`;
