import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const [login, ...extras] = process.argv.slice(2);

  if (!login || extras.length) {
    throw new Error("Indica el login de un administrador.");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Esta práctica sólo está disponible en desarrollo.");
  }

  const { prisma } = await import("../src/lib/prisma");

  try {
    const { descargarEstadosInegi, leerEstadosExistentes, prepararPlanEstados } = await import("../src/modules/ubicaciones/imports/estados-inegi");

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
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "No se pudo preparar el plan.");
  process.exitCode = 1;
});
