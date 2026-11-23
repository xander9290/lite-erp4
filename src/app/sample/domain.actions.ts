"use server";
import { z } from "zod";
import { modelLookupSchema, type ModelLookupRequest } from "@/lib/many2one/model-lookup";
import type { Many2OneResult } from "@/lib/many2one/types";
import { compileRelationDomain } from "@/lib/orm/domain";
import { domainSampleCountries, domainSampleStates, domainSampleFields, domainSampleTargets, recordDomainSampleContacts, recordDomainSampleFields } from "./domain.sample-contract";
import type { DomainRecord } from "@/lib/orm/domain-builder";

/** Public fictional fixtures only. Real lookups use modelRelationLookup and its authorized SQL. */
export async function sampleDomainLookup(kind: "pais" | "estado", input: ModelLookupRequest, draft: Record<string, unknown> = {}): Promise<Many2OneResult> {
  try {
    const request = modelLookupSchema.parse(input);
    const values = z.strictObject({ paisId: z.enum(["mx", "ca"]).nullable().optional() }).parse(draft);
    if (kind !== "pais" && kind !== "estado") throw new Error("invalid");
    const metadata = domainSampleFields.estadoId.metadata;
    if (kind === "estado" && metadata.kind === "many2one" && metadata.domain) compileRelationDomain(metadata.domain, domainSampleTargets, { paisId: domainSampleFields.paisId.metadata }, values);
    const resolving = Boolean(request.id || request.ids);
    const rows = (kind === "pais" ? domainSampleCountries : domainSampleStates).filter(row =>
      (!request.id || row.id === request.id) && (!request.ids || request.ids.includes(row.id)) && row.name.toLowerCase().includes(request.query.toLowerCase()) &&
      (kind === "pais" || resolving || "paisId" in row && row.paisId === values.paisId));
    const pageSize = request.ids?.length ?? request.pageSize;
    const page = Math.min(request.page, Math.max(1, Math.ceil(rows.length / pageSize)));
    return { ok: true, total: rows.length, page, pageSize, items: rows.slice((page - 1) * pageSize, page * pageSize).map(row => ({ value: row.id, label: row.name, record: { id: row.id }, ...(kind === "estado" ? { domainValid: "paisId" in row && row.paisId === values.paisId } : {}) })) };
  } catch { return { ok: false, error: "Consulta ficticia inválida." }; }
}

/** Fictional identity example, independent of ERP records and authentication. */
export async function sampleRecordDomainLookup(input: ModelLookupRequest, record: DomainRecord = {}): Promise<Many2OneResult> {
  try {
    const request = modelLookupSchema.parse(input);
    const identity = z.strictObject({ id: z.enum(["contact-a", "contact-b", "contact-c"]).optional() }).parse(record);
    const metadata = recordDomainSampleFields.parentId.metadata;
    if (metadata.kind !== "many2one" || !metadata.domain) throw new Error("invalid");
    compileRelationDomain(metadata.domain, {}, {}, {}, identity);
    const resolving = Boolean(request.id || request.ids);
    const rows = recordDomainSampleContacts.filter(row => (!request.id || row.id === request.id) && (!request.ids || request.ids.includes(row.id)) && row.name.toLowerCase().includes(request.query.toLowerCase()) && (resolving || row.id !== identity.id));
    const pageSize = request.ids?.length ?? request.pageSize;
    const page = Math.min(request.page, Math.max(1, Math.ceil(rows.length / pageSize)));
    return { ok: true, total: rows.length, page, pageSize, items: rows.slice((page - 1) * pageSize, page * pageSize).map(row => ({ value: row.id, label: row.name, record: { id: row.id }, domainValid: row.id !== identity.id })) };
  } catch { return { ok: false, error: "Consulta ficticia inválida." }; }
}
