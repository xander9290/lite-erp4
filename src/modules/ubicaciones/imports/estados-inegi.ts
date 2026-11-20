import type { ModelContext } from "@/lib/orm";
import "server-only";
import { z } from "zod";

export const estadosInegiSchema = z.object({
  datos: z
    .array(
      z.object({
        cve_ent: z.string().regex(/^[0-9]{2}$/),
        nomgeo: z.string().trim().min(1).max(120),
      }),
    )
    .min(1)
    .refine((estados) => new Set(estados.map((estado) => estado.cve_ent)).size === estados.length, {
      message: "INEGI devolvió claves de estado duplicadas.",
    }),
});

export async function descargarEstadosInegi() {
  const response = await fetch("https://gaia.inegi.org.mx/wscatgeo/v2/mgee/", {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`INEGI respondió con HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const resultado = estadosInegiSchema.parse(payload);

  return resultado.datos.map((estado) => ({
    codigo: estado.cve_ent,
    name: estado.nomgeo,
  }));
}

type EstadoInegi = Awaited<ReturnType<typeof descargarEstadosInegi>>[number];

type EstadoExistente = EstadoInegi & {
  id: string;
  revision: string;
};

export type PlanEstados = {
  crear: EstadoInegi[];
  actualizar: {
    actual: EstadoExistente;
    propuesto: EstadoInegi;
  }[];
  sinCambios: EstadoExistente[];
  conflictos: {
    codigo: string;
    motivo: string;
  }[];
};

export function prepararPlanEstados(nuevos: readonly EstadoInegi[], existentes: readonly EstadoExistente[]): PlanEstados {
  const plan: PlanEstados = {
    crear: [],
    actualizar: [],
    sinCambios: [],
    conflictos: [],
  };

  for (const propuesto of nuevos) {
    const coincidencias = existentes.filter((actual) => actual.codigo === propuesto.codigo);

    if (coincidencias.length > 1) {
      plan.conflictos.push({
        codigo: propuesto.codigo,
        motivo: "Hay varios registros con esta clave.",
      });
      continue;
    }

    const nombreRepetido = existentes.some((actual) => actual.codigo !== propuesto.codigo && actual.name.trim().toUpperCase() === propuesto.name.trim().toUpperCase());

    if (nombreRepetido) {
      plan.conflictos.push({
        codigo: propuesto.codigo,
        motivo: "Existe el mismo nombre con otra clave.",
      });
      continue;
    }

    const actual = coincidencias[0];

    if (!actual) {
      plan.crear.push(propuesto);
    } else if (actual.name !== propuesto.name) {
      plan.actualizar.push({ actual, propuesto });
    } else {
      plan.sinCambios.push(actual);
    }
  }

  return plan;
}

export async function leerEstadosExistentes(context: Pick<ModelContext, "tx" | "actor">, paisId: string): Promise<EstadoExistente[]> {
  const { authorizeModel } = await import("@/lib/access/engine");

  const scope = await authorizeModel(context.tx, context.actor, "ubicaciones.estado", "read");

  const estados = await context.tx.ubicacionesEstado.findMany({
    where: {
      AND: [{ paisId }, ...(scope ? [scope] : [])],
    },
    select: {
      id: true,
      codigo: true,
      name: true,
      updatedAt: true,
    },
  });

  return estados.map((estado) => ({
    id: estado.id,
    codigo: estado.codigo,
    name: estado.name,
    revision: estado.updatedAt.toISOString(),
  }));
}

export async function aplicarPlanEstados(context: Pick<ModelContext, "tx" | "actor">, paisId: string, nuevos: readonly EstadoInegi[], revisado: PlanEstados) {
  const usuario = await context.tx.user.findUnique({
    where: { id: context.actor.id },
    select: {
      active: true,
      isAdmin: true,
      sessionVersion: true,
    },
  });

  if (!usuario?.active || !usuario.isAdmin || usuario.sessionVersion !== context.actor.sessionVersion) {
    throw new Error("Se requiere un administrador activo y vigente.");
  }

  const pais = await context.tx.ubicacionesPais.findUnique({
    where: { id: paisId },
    select: { codigo: true },
  });

  if (pais?.codigo !== "MX") {
    throw new Error("El país de destino cambió. Revisa nuevamente el plan.");
  }

  const existentes = await leerEstadosExistentes(context, paisId);
  const vigente = prepararPlanEstados(nuevos, existentes);

  if (vigente.conflictos.length) {
    throw new Error("Resuelve los conflictos antes de importar.");
  }

  if (JSON.stringify(vigente) !== JSON.stringify(revisado)) {
    throw new Error("Los datos cambiaron. Genera nuevamente el plan.");
  }

  const { modelService } = await import("@/lib/modules/registry");
  const servicio = modelService("ubicaciones.estado");

  for (const estado of vigente.crear) {
    await servicio.transaction.persist(context.tx, context.actor, {
      ...estado,
      paisId,
      active: true,
    });
  }

  for (const cambio of vigente.actualizar) {
    const actual = await servicio.transaction.snapshot(context.tx, context.actor, cambio.actual.id, "write");

    if (!actual || actual.revision !== cambio.actual.revision) {
      throw new Error("Un estado cambió. Genera nuevamente el plan.");
    }

    await servicio.transaction.persist(context.tx, context.actor, {
      ...actual,
      ...cambio.propuesto,
    });
  }

  return {
    creados: vigente.crear.length,
    actualizados: vigente.actualizar.length,
  };
}
