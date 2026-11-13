import "server-only";
import type { ModuleDefinition } from "@/lib/modules/define";
import demo from "./demo/manifest";

/**
 * Declared modules (src/modules/<id>/manifest.ts). Explicit imports keep the set
 * reviewable and avoid filesystem discovery at runtime. create:module registers an
 * empty skeleton; add its models and run orm:sync before opening it. orm:sync also
 * registers hand-created modules after synchronizing their schema and Prisma Client.
 */
export const modules: readonly ModuleDefinition[] = [demo];
