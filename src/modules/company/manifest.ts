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
        fields: ["name", "image"],
      },
      defaultScreen: "companies",
      screens: {
        companies: {
          label: "Empresas",
          view: "card",
          domain: (d) => d.neq("partnerId", false),
          views: {
            form: () => import("./views/CompanyForm"),
          },
        },
        branches: {
          label: "Sucursales",
          view: "card",
          domain: (d) => d.neq("partnerId", true),
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
