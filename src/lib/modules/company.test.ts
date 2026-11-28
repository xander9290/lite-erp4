import assert from "node:assert/strict";
import test from "node:test";
import { Company } from "../../modules/company/models/company";
import company from "../../modules/company/manifest";
import { ModelValidationError, type ModelContext } from "../orm";

const model = new Company();

function context({ id, parent = { parentId: null as string | null }, hasChildren = false, country = "MX" }: {
  id?: string; parent?: { parentId: string | null } | null; hasChildren?: boolean; country?: string;
} = {}) {
  const queries: unknown[] = [];
  return { queries, value: {
    id,
    tx: {
      companyCompany: {
        findUnique: async (args: unknown) => { queries.push(args); return parent; },
        findFirst: async (args: unknown) => { queries.push(args); return hasChildren ? { id: "hidden-child" } : null; },
      },
      ubicacionesPais: { findUnique: async (args: { select: unknown }) => { assert.deepEqual(args.select, { codigo: true }); return { codigo: country }; } },
    },
    // A Company-only user need not have direct entry to Ubicaciones for validation.
    env: new Proxy({}, { get() { throw new Error("No hay acceso directo a Ubicaciones"); } }),
  } as unknown as ModelContext };
}

test("Company normalizes identity and contact data without converting missing values to text", () => {
  const result = model.normalize({ name: "  Centro  ", code: " ab01 ", email: " info@example.com ", vat: " xaxx010101000 ", zipNumber: " 00100 ", phone: " +52 33 1234 5678 ", active: false });
  assert.deepEqual(result, { name: "CENTRO", code: "AB01", email: "info@example.com", vat: "XAXX010101000", zipNumber: "00100", phone: "+52 33 1234 5678", active: false });
  assert.equal(model.normalize({ name: null }).name, null);
  assert.equal(model.normalize({ code: 12 }).code, 12);
  assert.doesNotThrow(() => model.validarCorreo({ email: "info@example.com" }));
  assert.doesNotThrow(() => model.validarCorreo({ email: "" }));
  assert.throws(() => model.validarCorreo({ email: "incorrecto" }), error => error instanceof ModelValidationError && Boolean(error.fieldErrors?.email));
});

test("Company validates Mexican RFC/CP only for Mexico, including impossible calendar dates", async () => {
  const mx = context().value;
  await model.validarDatosMexicanos({ countryId: "mx", vat: "XAXX010101000", zipNumber: "00100" }, mx);
  await model.validarDatosMexicanos({ countryId: "mx", vat: "ABC240229ABC" }, mx);
  await model.validarDatosMexicanos({ countryId: "mx", vat: "", zipNumber: "" }, mx);
  for (const vat of ["ABC230229ABC", "ABC241331ABC", "incorrecto"]) {
    await assert.rejects(model.validarDatosMexicanos({ countryId: "mx", vat }, mx), error => error instanceof ModelValidationError && Boolean(error.fieldErrors?.vat));
  }
  await assert.rejects(model.validarDatosMexicanos({ countryId: "mx", zipNumber: "1000" }, mx), error => error instanceof ModelValidationError && Boolean(error.fieldErrors?.zipNumber));
  await model.validarDatosMexicanos({ countryId: "ca", vat: "OTRO", zipNumber: "H2B 1X9" }, context({ country: "CA" }).value);
  await model.validarDatosMexicanos({ countryId: null, vat: "OTRO", zipNumber: "H2B 1X9" }, mx);
});

test("Company rejects self-parenting, unavailable/branch parents and moving a root with children", async () => {
  for (const options of [{ id: "self" }, { parent: null }, { parent: { parentId: "root" } }, { id: "root-with-children", hasChildren: true }]) {
    await assert.rejects(model.validarJerarquia({ parentId: "self" }, context(options).value), error => error instanceof ModelValidationError && Boolean(error.fieldErrors?.parentId));
  }
  await model.validarJerarquia({ parentId: "root" }, context().value);
  await model.validarJerarquia({ parentId: "root" }, context({ id: "branch" }).value);
  const detached = context({ id: "root", hasChildren: true });
  await model.validarJerarquia({ parentId: null, active: false }, detached.value);
  assert.equal(detached.queries.length, 0, "independent activation does not query or modify descendants");
});

test("Company keeps a unique global code, repeatable names, searchable code and inactive filters", () => {
  const entry = company.models.find(entry => entry.id === "company.company")!;
  assert.equal(entry.metadata.code.unique, true);
  assert.notEqual(entry.metadata.name.unique, true);
  assert.deepEqual(entry.contract.uniqueTogether ?? [], []);
  assert.deepEqual(entry.list.searchFields, ["name", "code"]);
  assert.ok(entry.list.filterable?.includes("active"));
  assert.deepEqual(company.profile.module.depends, ["ubicaciones"]);
  assert.ok(entry.screens.companies.collectionViews.includes("list"));
  assert.ok(entry.screens.branches.collectionViews.includes("list"));
});

test("Company grants consultation, editing and administration separately without cross-module grants", () => {
  assert.deepEqual(company.access.grants.map(grant => ({ group: grant.group, model: grant.model, ...grant.perms })), [
    { group: "company.admin", model: "company.company", create: true, read: true, write: true, unlink: true },
    { group: "company.auxiliar", model: "company.company", create: true, read: true, write: true, unlink: false },
    { group: "company.read", model: "company.company", create: false, read: true, write: false, unlink: false },
  ]);
});
