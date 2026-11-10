import { applicationHref, canOpenApplication, type ApplicationManifest, type ApplicationMenu, type ApplicationMenuLink } from "./manifest";

/** Serializable presentation metadata; no model profiles or icon components. */
export type ApplicationNavigation = { id: string; name: string; href: string; menus: readonly ApplicationMenu[] };

export function applicationNavigation(application: ApplicationManifest, actor: { isAdmin: boolean } | null): ApplicationNavigation | null {
  if (!canOpenApplication(application, actor)) return null;
  const visible = (item: { access?: "authenticated" | "admin" }) => item.access !== "admin" || Boolean(actor?.isAdmin);
  const menus: ApplicationMenu[] = [];
  for (const item of application.menus ?? []) {
    if (!visible(item)) continue;
    if ("items" in item) {
      const items = item.items.filter(visible);
      if (items.length) menus.push({ ...item, items });
    } else menus.push(item);
  }
  return { id: application.id, name: application.name, href: applicationHref(application), menus };
}

export function activeApplication(applications: readonly ApplicationNavigation[], pathname: string) {
  return applications.find(application => pathname === application.href || pathname.startsWith(`${application.href}/`));
}

/** Prefer the most specific matching route; list links also cover record forms. */
export function activeApplicationMenu(menus: readonly ApplicationMenu[], pathname: string): ApplicationMenuLink | undefined {
  const links = menus.flatMap(item => "items" in item ? item.items : [item]);
  return links.filter(item => pathname === item.href || (item.match !== "exact" && pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
