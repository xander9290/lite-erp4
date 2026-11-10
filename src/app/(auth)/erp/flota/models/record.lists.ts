import "server-only";
import { recordService } from "./record.service";

// El creador se obtiene de la sesión revalidada, nunca de los filtros del navegador.
export const myVehicles = recordService.defineListAction({
  domain: ({ actor }) => [{ field: "createBy", operator: "eq", value: actor.id }],
});

export const myActiveVehicles = recordService.defineListAction({
  domain: ({ actor }) => [
    { field: "createBy", operator: "eq", value: actor.id },
    { field: "active", operator: "eq", value: true },
  ],
});
