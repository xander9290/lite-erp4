import { Company } from "./models/company";
import "server-only";
import { defineModule } from "@/lib/modules/define";

export default defineModule({
  id: "company",
  name: "Empresas",
  icon: "building-complex",
  depends: ["ubicaciones"],
  models: {
    company: {
      model: Company,
      list: {
        fields: ["name", "code", "image", "parentId", "provinceId", "countyId", "active"],
        searchFields: ["name", "code"],
      },
      defaultScreen: "companies",
      screens: {
        companies: {
          label: "Empresas",
          view: "card",
          domain: (d) => d.eq("parentId", null),
          views: {
            form: () => import("./views/CompanyForm"),
            card: () => import("./views/CompanyCompaniesCard"),
            list: true,
          },
        },
        branches: {
          label: "Sucursales",
          view: "card",
          domain: (d) => d.neq("parentId", null),
          views: {
            form: () => import("./views/CompanyForm"),
            card: () => import("./views/CompanyCompaniesCard"),
            list: () => import("./views/CompanyBranchesList"),
          },
        },
      },
      pages: {
        companyInfo: { generalInfo: "Información general", branches: "Sucursales" },
      },
    },
  },
  menu: {
    Catálogos: {
      Empresas: {
        model: "company",
        screen: "companies",
      },
      Sucursales: {
        model: "company",
        screen: "branches",
      },
    },
  },
  groups: { admin: "Administrador", auxiliar: "Auxiliar", read: "Consulta" },
  access: [
    { group: "admin", models: "company", perms: "crud" },
    { group: "auxiliar", models: "company", perms: "cru" },
    { group: "read", models: "company", perms: "r" },
  ],
});
