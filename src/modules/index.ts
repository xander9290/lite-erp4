import "server-only";
import type { ModuleDefinition } from "@/lib/modules/define";
import demo from "./demo/manifest";

/**
 * Installed declarative modules (src/modules/<id>/manifest.ts). Explicit imports keep the
 * set reviewable and avoid filesystem discovery at runtime. Register a module only after
 * its schema is installed with `npm run orm:sync -- <id>`; it will be generated later.
 */
export const modules: readonly ModuleDefinition[] = [demo];
