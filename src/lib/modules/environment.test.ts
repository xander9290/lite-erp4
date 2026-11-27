import assert from "node:assert/strict";
import { test } from "node:test";
import { Fields, Model } from "../orm";
import { defineModule } from "./define";
import core from "../core/manifest";
import { createEnvironment, environmentModels } from "./environment";
import { composeModules } from "./compose";
import { extendModel } from "./extend";
import { User } from "../core/models/user";
import type { ModelEnvironmentModel } from "../orm/environment";

class Item extends Model { name = Fields.Text({ required: true }); }
class Order extends Model { name = Fields.Text({ required: true }); }
class Other extends Model { name = Fields.Text({ required: true }); }
const catalog = defineModule({ id: "catalog", name: "Catálogo", icon: "list", models: { item: Item } });
const sales = defineModule({ id: "sales", name: "Ventas", icon: "list", depends: ["catalog"], models: { order: Order } });
const unrelated = defineModule({ id: "unrelated", name: "Otra", icon: "list", models: { other: Other } });
const modules = [core, catalog, sales, unrelated];

test("env exposes the module's own models, its declared dependencies and core only", () => {
  const visible = environmentModels(modules, sales);
  assert.deepEqual([...visible.keys()].sort(), ["CatalogItem", "SalesOrder", "User"]);
  assert.equal(visible.get("CatalogItem"), "catalog.item");
  assert.deepEqual([...environmentModels(modules, catalog).keys()].sort(), ["CatalogItem", "User"]);
});

test("env builds a facade lazily per access and rejects unknown models with a hint", () => {
  const built: string[] = [];
  const facade = (id: string) => { built.push(id); return { id } as unknown as ModelEnvironmentModel; };
  const env = createEnvironment("sales", environmentModels(modules, sales), facade) as unknown as Record<string, unknown>;
  assert.equal(built.length, 0, "nothing is built until a model is accessed");
  assert.deepEqual(env.CatalogItem, { id: "catalog.item" });
  assert.deepEqual(built, ["catalog.item"]);
  assert.throws(() => env.UnrelatedOther, /no disponible para sales[\s\S]*depends/);
  assert.equal(env.then, undefined, "awaiting env never treats it as a promise");
  assert.ok("SalesOrder" in env && !("UnrelatedOther" in env));
  assert.deepEqual(Object.keys(env).sort(), ["CatalogItem", "SalesOrder", "User"]);
  assert.throws(() => { "use strict"; env.CatalogItem = {}; }, TypeError);
});

test("methods of an extended model see the extending modules and their dependencies", () => {
  const Extra = extendModel(User, Base => { class Extra extends Base { itemId = Fields.Many2one("CatalogItem"); } return Extra; });
  class Contact extends Model { name = Fields.Text({ required: true }); }
  const directory = defineModule({ id: "directory", name: "Directorio", icon: "users", depends: ["catalog"], models: { contact: Contact }, extends: { "core.user": Extra } });
  const composed = composeModules([core, catalog, directory, unrelated]);
  const [composedCore] = composed;
  const user = composedCore.models.find(model => model.id === "core.user")!;
  assert.deepEqual([...environmentModels(composed, composedCore, user).keys()].sort(), ["CatalogItem", "DirectoryContact", "User"]);
  assert.deepEqual([...environmentModels(composed, composedCore).keys()].sort(), ["User"], "without the entry only core is reachable");
});
