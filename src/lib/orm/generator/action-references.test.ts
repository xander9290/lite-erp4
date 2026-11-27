import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { action, Fields, Model } from "../index";
import { defineModule } from "../../modules/define";
import { extendModel } from "../../modules/extend";
import { actionReferenceFiles } from "./action-references";
import { generateModule } from "./generate";

class Order extends Model {
  name = Fields.Text();
  ordinaryMethod() { return "PRIVATE_IMPLEMENTATION"; }
  @action({ label: "PRIVATE_LABEL", groups: ["privategroup"] }) confirmar() { return { name: "PRIVATE_BODY" }; }
}
const base = defineModule({ id: "orders", name: "Pedidos", icon: "list", models: { order: Order } });

test("generation publishes decorated actions only, scopes extension references to the base and updates removed actions", () => {
  const first = actionReferenceFiles(base.profile.module);
  assert.match(first["OrdersOrder.actions.ts"], /defineActionReferences\("OrdersOrder", \["confirmar"\]\)/);
  assert.doesNotMatch(first["OrdersOrder.actions.ts"], /ordinaryMethod|PRIVATE_|privategroup|server-only/);
  const extra = extendModel(Order, Base => {
    class Extra extends Base { note = Fields.Text(); @action({ label: "Escalar" }) escalar() { return {}; } }
    return Extra;
  });
  const extension = defineModule({ id: "ordersplus", name: "Más", icon: "list", depends: ["orders"], models: {}, extends: { "orders.order": extra } });
  assert.match(actionReferenceFiles(extension.profile.module)["OrdersplusOrdersOrder.actions.ts"], /defineActionReferences\("OrdersOrder", \["confirmar","escalar"\]\)/);
  class NoActions extends Model { name = Fields.Text(); }
  const removed = defineModule({ id: "orders", name: "Pedidos", icon: "list", models: { order: NoActions } });
  assert.match(actionReferenceFiles(removed.profile.module)["OrdersOrder.actions.ts"], /defineActionReferences\("OrdersOrder", \[\]\)/);
  const context = { schema: 'datasource db {\n provider = "postgresql"\n}\nmodel User {\n id String @id\n}\n', owners: {} };
  assert.equal(generateModule(base.profile.module, context)["models.prisma"], generateModule(removed.profile.module, context)["models.prisma"], "publishing actions never changes the SQL schema");
});

test("actions-only CLI plans without writes, generates, detects staleness and preserves edited files without a database", async () => {
  const root = await mkdtemp(join(process.cwd(), ".modules-test-action-contracts-"));
  const project = process.cwd();
  const dir = join(root, "src/modules/example");
  const generated = join(root, "src/generated/orm/actions/example/ExampleItem.actions.ts");
  const run = (...args: string[]) => spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", join(project, "scripts/orm-generate.ts"), "example", ...(args.includes("--forms-only") ? [] : ["--actions-only"]), ...args], { cwd: root, env: { ...process.env, TSX_TSCONFIG_PATH: join(root, "tsconfig.json"), DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused" }, encoding: "utf8", timeout: 20000 });
  try {
    await mkdir(dir, { recursive: true });
    await symlink(join(project, "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ extends: join(project, "tsconfig.json"), compilerOptions: { incremental: false, experimentalDecorators: true }, include: ["**/*.ts", join(project, "src/types/next-auth.d.ts")], exclude: [] }));
    const source = (method = "confirmar") => `import { Fields, Model, action } from ${JSON.stringify("../../../../src/lib/orm/index")};\nimport { defineModule } from ${JSON.stringify("../../../../src/lib/modules/define")};\nclass Item extends Model { name = Fields.Text(); @action({label:"Confirmar"}) ${method}() { return {}; } }\nexport default defineModule({id:"example",name:"Example",icon:"list",models:{item:Item}});\n`;
    await writeFile(join(dir, "manifest.ts"), source());
    const plan = run(); assert.equal(plan.status, 0, plan.stderr); assert.match(plan.stdout, /create actions\/ExampleItem.actions.ts/);
    await assert.rejects(readFile(generated), { code: "ENOENT" });
    const write = run("--write"); assert.equal(write.status, 0, write.stderr);
    assert.match(await readFile(generated, "utf8"), /\["confirmar"\]/);
    const formFile = join(root, "src/generated/orm/forms/example/ExampleItem.form.ts");
    assert.equal(run("--forms-only").status, 0);
    await assert.rejects(readFile(formFile), { code: "ENOENT" });
    assert.equal(run("--forms-only", "--write").status, 0);
    assert.match(await readFile(formFile, "utf8"), /defineModelFormReference/);
    assert.equal(run("--forms-only", "--check").status, 0);

    await writeFile(join(root, "contract-check.ts"), `import { ExampleItemActions } from "./src/generated/orm/actions/example/ExampleItem.actions";\nimport type { FormButtonProps } from ${JSON.stringify(join(project, "src/components/ui/form/formActions"))};\nconst valid: FormButtonProps = {action:ExampleItemActions.confirmar};\n// @ts-expect-error Missing action must fail in the generated contract.\nconst typo: FormButtonProps = {action:ExampleItemActions.confimar};\n// @ts-expect-error Arbitrary text must fail.\nconst raw: FormButtonProps = {action:"confirmar"};\nvoid [valid,typo,raw];\n`);
    await writeFile(join(root, "form-contract-check.ts"), `import { ExampleItemForm } from "./src/generated/orm/forms/example/ExampleItem.form";
import type { ModelFormButtonProps } from "../src/components/modules/ModelFormButton";
const valid: ModelFormButtonProps<typeof ExampleItemForm> = {form:ExampleItemForm,defaults:{name:"Example"}};
// @ts-expect-error A typo must fail.
const typo: ModelFormButtonProps<typeof ExampleItemForm> = {form:ExampleItemForm,defaults:{naem:"Example"}};
void [valid,typo];
`);
    const types = spawnSync(process.execPath, [join(project, "node_modules/typescript/bin/tsc"), "--project", join(root, "tsconfig.json"), "--noEmit"], { cwd: root, encoding: "utf8", timeout: 90000 });
    assert.equal(types.status, 0, types.stdout + types.stderr + (types.error?.message ?? ""));
    assert.equal(run("--check").status, 0);
    await writeFile(join(dir, "manifest.ts"), source("cancelar"));
    assert.equal(run("--check").status, 2);
    assert.equal(run("--write").status, 0);
    assert.match(await readFile(generated, "utf8"), /\["cancelar"\]/);
    await writeFile(generated, "// custom edit\n");
    const refused = run("--write"); assert.equal(refused.status, 1); assert.match(refused.stderr, /modificado/);
    assert.equal(await readFile(generated, "utf8"), "// custom edit\n");
    await assert.rejects(readFile(join(root, "prisma/models/schema.prisma")), { code: "ENOENT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("context.env types cover own persistent public fields, never companions, secrets or virtual fields", () => {
  class Ticket extends Model {
    name = Fields.Text({ required: true });
    note = Fields.Text();
    state = Fields.Selection([{ label: "Abierto", value: "open" }, { label: "Cerrado", value: "closed" }], { required: true });
    hours = Fields.Integer();
    done = Fields.Boolean();
    token = Fields.Text({ sensitive: true });
  }
  const desk = defineModule({ id: "desk", name: "Mesa", icon: "list", models: { ticket: Ticket } });
  const file = actionReferenceFiles(desk.profile.module)["environment.ts"];
  assert.match(file, /declare module "@\/lib\/orm\/environment"/);
  assert.match(file, /DeskTicket: \{\n      done: boolean;\n      hours: number \| null;\n      name: string;\n      note: string \| null;\n      state: "open" \| "closed";\n    \};/);
  assert.doesNotMatch(file, /token/);
});
