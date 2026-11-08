import { z } from "zod";

export const patientHistorySchema = z.strictObject({
  patientId: z.string().trim().min(1).max(100),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});
