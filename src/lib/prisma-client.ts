import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

/** Shared construction for the server, seed and integration checks. */
export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Configura DATABASE_URL para conectar con PostgreSQL.");
  const schema = new URL(connectionString).searchParams.get("schema") ?? "public";
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });
}
