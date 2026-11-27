import { Company } from "./models/company";
import "server-only";
import { defineModule } from "@/lib/modules/define";

export default defineModule({
  id: "company",
  name: "Empresas",
  icon: "building-complex",
  depends: ["ubicaciones", "directory"],
  models: {
    company: {
      model: Company,
      list: {
        fields: ["name", "image", "parentId", "provinceId", "countyId"],
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
          },
        },
        branches: {
          label: "Sucursales",
          view: "card",
          domain: (d) => d.neq("parentId", null),
          views: {
            form: () => import("./views/CompanyForm"),
          },
        },
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
});
