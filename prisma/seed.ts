import { config } from "dotenv";
import { createPrismaClient } from "../src/lib/prisma-client";
import { hashPassword } from "../src/lib/auth/password";

config({ path: ".env.local", quiet: true });
config({ quiet: true });
const prisma = createPrismaClient();
try {
  const password = await hashPassword("1234");
  await prisma.user.upsert({
    where: { login: "admin" }, update: {},
    create: { login: "admin", password, active: true, isAdmin: true, partner: { create: { name: "Administrador" } } },
  });
  console.log("Seed completado: admin existe. Las credenciales y los permisos de una cuenta existente se conservan.");
} finally { await prisma.$disconnect(); }
