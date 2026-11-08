import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { prismaConnectionOptions } from "./prisma-connection";

/** Shared construction for the server, seed and integration checks. */
export function createPrismaClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("Configura DATABASE_URL para conectar con PostgreSQL.");
  const { schema, connectionString: utcConnectionString } = prismaConnectionOptions(connectionString);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: utcConnectionString }, { schema }) });
}
