import "server-only";
import { recordService } from "./record.service";

// List actions are fixed on the server. These domains do not grant record access.
export const recordLists = {
  all: recordService.defineListAction(),
  mine: recordService.defineListAction({ domain: ({ actor }) => [
    { field: "createBy", operator: "eq", value: actor.id },
  ] }),
  active: recordService.defineListAction({ domain: [
    { field: "active", operator: "eq", value: true },
  ] }),
};
