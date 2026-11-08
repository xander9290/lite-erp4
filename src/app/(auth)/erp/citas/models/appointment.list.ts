import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { compileListFilters, validateListFilters } from "@/lib/list/filters";
import { listConfigSchema, listStateSchema } from "@/lib/list/query";
import { normalizeListState } from "@/lib/list/state";
import type { ListConfig, ListPage, ListState } from "@/lib/list/types";
import { lookupWords } from "@/lib/many2one/query";
import { appointmentAgenda } from "../agenda";
import { assertClinicalActor, type ClinicalActor } from "./access";

/** Clinical list has its own authorization boundary, independent of the generic list action. */
export async function listAppointmentRecords(prisma: PrismaClient, actor: ClinicalActor, inputConfig: ListConfig, inputState: ListState): Promise<ListPage> {
  const config = listConfigSchema.parse(inputConfig);
  const parsedState = listStateSchema.parse(inputState);
  if (config.model !== "dentalAppointment" || parsedState.invalidFilters || validateListFilters(config, parsedState.filters) || parsedState.filters.some(filter => filter.field === "status")) {
    throw new Error("La configuración o los filtros de citas no son válidos.");
  }
  const state = normalizeListState(config, parsedState);
  const where = { AND: [
    ...lookupWords(state.query).map(word => ({ OR: config.searchFields.map(field => {
      const text = { contains: word, mode: "insensitive" as const };
      if (field === "patient.name") return { patient: { is: { name: text } } };
      if (field === "patient.phone") return { patient: { is: { phone: text } } };
      if (field === "id") return { id: text };
      return { reason: text };
    }) })), ...compileListFilters(config, state.filters),
  ] } as Prisma.DentalAppointmentWhereInput;
  const order: Prisma.DentalAppointmentOrderByWithRelationInput = state.sort === "patient.name" ? { patient: { name: state.direction } }
    : state.sort === "patient.phone" ? { patient: { phone: { sort: state.direction, nulls: "last" } } }
    : state.sort === "reason" ? { reason: state.direction } : state.sort === "status" ? { status: state.direction }
    : state.sort === "id" ? { id: state.direction } : { scheduledAt: state.direction };
  return prisma.$transaction(async tx => {
    await assertClinicalActor(tx, actor);
    const total = await tx.dentalAppointment.count({ where });
    const page = Math.min(state.page, Math.max(1, Math.ceil(total / state.pageSize)));
    const records = await tx.dentalAppointment.findMany({
      where, skip: (page - 1) * state.pageSize, take: state.pageSize, orderBy: [order, { id: "asc" }],
      select: { id: true, reason: true, scheduledAt: true, status: true, patient: { select: { name: true, phone: true, avatarUrl: true } } },
    });
    const now = new Date();
    return { rows: records.map(record => ({ ...record, scheduledAt: record.scheduledAt.toISOString(), agenda: appointmentAgenda(record.scheduledAt, record.status, now) })), total, page, pageSize: state.pageSize };
  }, { isolationLevel: "RepeatableRead" });
}
