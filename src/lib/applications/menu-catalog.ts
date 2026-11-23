import type { ApplicationManifest } from "./manifest";

export type GroupMenu = { application: string; applicationLabel: string; id: string; label: string; model?: string; href?: string; parent?: string };
/** Native presentations belong to their model's module. */
export function applicationMenuOwner(application: Pick<ApplicationManifest, "id" | "accessModels">) {
  const owners = [...new Set(application.accessModels?.map(model => model.split(".")[0]) ?? [])];
  return owners.length === 1 ? owners[0] : application.id;
}

/** IDs are validated by the application registry; labels may change without losing policy. */
export function groupMenus(applications: readonly Pick<ApplicationManifest, "id" | "name" | "accessModels" | "menus">[], module: string): GroupMenu[] {
  return applications.filter(app => applicationMenuOwner(app) === module).flatMap(app => (app.menus ?? []).flatMap(menu => {
    const base = { application: app.id, applicationLabel: app.name };
    return "items" in menu
      ? [{ ...base, id: menu.id, label: menu.label }, ...menu.items.map(item => ({ ...base, id: item.id, label: item.label, model: item.model, href: item.href, parent: menu.label }))]
      : [{ ...base, id: menu.id, label: menu.label, model: menu.model, href: menu.href }];
  }));
}

/** Metadata only: do not load icon components in scripts or access transactions. */
export async function registeredGroupMenus(module: string) {
  const { registeredModules } = await import("../modules/installed");
  return groupMenus([...registeredModules.filter(item => !item.native && item.models.length).map(item => item.application)], module);
}
