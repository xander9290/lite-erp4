import { config } from "dotenv";
import { createInterface } from "node:readline/promises";

config({ path: ".env.local", quiet: true });

async function main() {
  const [login, modo, ...extras] = process.argv.slice(2);
  const aplicar = modo === "--aplicar";

  if (!login || login.startsWith("--") || extras.length || (modo !== undefined && !aplicar)) {
    throw new Error("Uso: npm run ubicaciones:import -- LOGIN [--aplicar]");
  }

  if (aplicar && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    throw new Error("Abre una terminal interactiva para revisar y confirmar la importación.");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Esta práctica sólo está disponible en desarrollo.");
  }

  const { prisma } = await import("../src/lib/prisma");

  try {
    const { descargarEstadosInegi, leerEstadosExistentes, prepararPlanEstados, aplicarPlanEstados } = await import("../src/modules/ubicaciones/imports/estados-inegi");

    const nuevos = await descargarEstadosInegi();

    const resultado = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;

        const usuario = await tx.user.findUnique({
          where: { login },
          select: {
            id: true,
            active: true,
            isAdmin: true,
            sessionVersion: true,
          },
        });

        if (!usuario?.active || !usuario.isAdmin) {
          throw new Error("Se requiere un administrador activo.");
        }

        const pais = await tx.ubicacionesPais.findUnique({
          where: { codigo: "MX" },
          select: { id: true },
        });

        if (!pais) {
          throw new Error("Primero registra México con código MX.");
        }

        const actor = {
          id: usuario.id,
          sessionVersion: usuario.sessionVersion,
        };

        const existentes = await leerEstadosExistentes({ tx, actor }, pais.id);

        return {
          actor,
          paisId: pais.id,
          plan: prepararPlanEstados(nuevos, existentes),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );

    console.log(JSON.stringify(resultado.plan, null, 2));
    if (!aplicar) return;
    if (resultado.plan.conflictos.length) throw new Error("Resuelve los conflictos antes de aplicar.");
    if (!resultado.plan.crear.length && !resultado.plan.actualizar.length) {
      console.log("No hay cambios que aplicar.");
      return;
    }

    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    const respuesta = await terminal.question("¿Aplicar el plan mostrado? Escribe aplicar: ").finally(() => terminal.close());
    if (respuesta.trim() !== "aplicar") {
      console.log("Importación cancelada. No se guardaron cambios.");
      return;
    }

    const resumen = await prisma.$transaction(
      tx => aplicarPlanEstados({ tx, actor: resultado.actor }, resultado.paisId, nuevos, resultado.plan),
      { isolationLevel: "Serializable", timeout: 60_000 },
    );
    console.table(resumen);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "No se pudo completar la importación.";
  console.error(process.env.DATABASE_URL ? message.replaceAll(process.env.DATABASE_URL, "[base de datos]") : message);
  process.exitCode = 1;
});
