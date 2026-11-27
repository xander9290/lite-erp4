import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

test("modal CLI generates own and extended forms without a database; plans, collisions and symlinks preserve files", async () => {
  const project = process.cwd();
  const root = await mkdtemp(join(project, ".modules-test-eject-"));
  const base = join(root, "src/modules/example");
  const addon = join(root, "src/modules/extra");
  const script = join(project, "scripts/eject-view.ts");
  const run = (...args: string[]) => spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", script, ...args], { cwd: root, env: { ...process.env, TSX_TSCONFIG_PATH: join(project, "tsconfig.json"), DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused" }, encoding: "utf8", timeout: 20000 });
  try {
    await mkdir(join(base, "models"), { recursive: true });
    await mkdir(join(addon, "models"), { recursive: true });
    await symlink(join(project, "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ extends: join(project, "tsconfig.json"), compilerOptions: { incremental: false, experimentalDecorators: true, paths: { "@/*": [join(root, "src/*"), join(project, "src/*")] } }, include: ["src/**/*.ts", "src/**/*.tsx", join(project, "src/types/next-auth.d.ts"), `${project.replaceAll("\\", "/")}/src/generated/orm/actions/*/environment.ts`], exclude: [] }));
    await writeFile(join(base, "models/item.ts"), `import { Fields, Model } from "@/lib/orm";
export class Item extends Model { name = Fields.Text(); parentId = Fields.Many2one("ExampleItem"); childIds = Fields.One2many("ExampleChild", {inverse:"itemId", readonly:true}); }
export class Child extends Model { name = Fields.Text(); itemId = Fields.Many2one("ExampleItem"); }
`);
    const manifest = `import { defineModule } from "@/lib/modules/define";
import { Item, Child } from "./models/item";
export default defineModule({id:"example",name:"Example",icon:"box",models:{item:Item,child:Child}});
`;
    await writeFile(join(base, "manifest.ts"), manifest);
    await writeFile(join(addon, "models/extra.ts"), `import { Fields } from "@/lib/orm";
import { extendModel } from "@/lib/modules/extend";
import { Item } from "../../example/models/item";
export const Extra = extendModel(Item, Base => class extends Base { note = Fields.Text(); });
`);
    const extraManifest = `import { defineModule } from "@/lib/modules/define";
import { Extra } from "./models/extra";
export default defineModule({id:"extra",name:"Extra",icon:"box",depends:["example"],models:{},extends:{"example.item":Extra}});
`;
    await writeFile(join(addon, "manifest.ts"), extraManifest);
    const own = join(base, "views/ItemModal.tsx");
    const extended = join(addon, "views/ExampleItemModal.tsx");
    for (const args of [["example", "item"], ["extra", "example.item"]]) {
      const plan = run(...args, "modal", "--dry-run");
      assert.equal(plan.status, 0, plan.stdout + plan.stderr);
    }
    assert.equal(await readFile(join(base, "manifest.ts"), "utf8"), manifest);
    assert.equal(await readFile(join(addon, "manifest.ts"), "utf8"), extraManifest);
    await assert.rejects(readFile(own), { code: "ENOENT" });
    await assert.rejects(readFile(extended), { code: "ENOENT" });
    for (const args of [["example", "item"], ["extra", "example.item"]]) {
      const write = run(...args, "modal");
      assert.equal(write.status, 0, write.stdout + write.stderr);
    }
    assert.match(await readFile(own, "utf8"), /FormValues<typeof Item>/);
    const source = await readFile(extended, "utf8");
    assert.match(source, /name="name"/);
    assert.match(source, /name="note"/);
    assert.match(source, /<FieldMany2One<Values> name="parentId"/);
    assert.match(source, /ModelChildCollections name="childIds" openIn="modal"/);
    const check = spawnSync(process.execPath, [join(project, "node_modules/typescript/bin/tsc"), "--project", join(root, "tsconfig.json"), "--noEmit"], { cwd: root, encoding: "utf8", timeout: 90000 });
    assert.equal(check.status, 0, check.stdout + check.stderr + (check.error?.message ?? ""));
    await writeFile(extended, source + "\n// User layout\n");
    const collision = run("extra", "example.item", "modal");
    assert.equal(collision.status, 1);
    assert.match(collision.stderr, /no se sobrescribe/);
    assert.equal(await readFile(extended, "utf8"), source + "\n// User layout\n");
    const linkDir = join(root, "src/modules/linked");
    await symlink(addon, linkDir, process.platform === "win32" ? "junction" : "dir");
    const linked = run("linked", "example.item", "modal");
    assert.equal(linked.status, 1);
    assert.match(linked.stderr, /simbólicos/);
    // Existing modal insertions keep ownership of their fields when ejecting a layout.
    await rm(extended);
    await writeFile(join(addon, "manifest.ts"), extraManifest.replace('"example.item":Extra', '"example.item":{model:Extra,insertions:{modal:async()=>({default:()=>null})}}'));
    const withInsertions = run("extra", "example.item", "modal");
    assert.equal(withInsertions.status, 0, withInsertions.stdout + withInsertions.stderr);
    assert.doesNotMatch(await readFile(extended, "utf8"), /name="note"/);
    assert.match(await readFile(join(addon, "manifest.ts"), "utf8"), /insertions:\{modal:async/);
    await assert.rejects(readFile(join(root, "prisma/models/schema.prisma")), { code: "ENOENT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});
