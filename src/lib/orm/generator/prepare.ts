import "server-only";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { generateModule, type ModuleGeneration } from "./generate";
import { generationBaseline } from "./installation-state";
import { prismaBlocks } from "./prisma-source";

/** Validate and compare schema files only; does not connect to or migrate a database. */
export async function prepareModuleArtifacts(root: string, profile: ModuleGeneration, owners: Readonly<Record<string, string>>) {
  const schemaDirectory = join(root, "prisma/models");
  const baseline = await generationBaseline(root, profile.id);
  for (const [model, owner] of Object.entries(baseline.owners)) {
    if (owners[model] && owners[model] !== owner) throw new Error(`El propietario declarado de ${model} no coincide con su instalación.`);
  }
  const files = generateModule(profile, { schema: baseline.schema, owners: { ...owners, ...baseline.owners } });
  for (const inverse of baseline.downstream) {
    const block = prismaBlocks(files["schema.preview.prisma"]).find(item => item.kind === "model" && item.name === inverse.target);
    if (!block) throw new Error(`No se puede retirar ${inverse.target}: otro módulo depende de él.`);
    const source = files["schema.preview.prisma"];
    files["schema.preview.prisma"] = source.slice(0, block.end - 1) + inverse.text + source.slice(block.end - 1);
  }
  const temporary = await mkdtemp(join(tmpdir(), "lite-erp-schema-"));
  try {
    const preview = join(temporary, "schema.prisma");
    await writeFile(preview, files["schema.preview.prisma"]);
    const run = (args: string[]) => {
      const result = spawnSync(process.execPath, [join(root, "node_modules/prisma/build/index.js"), ...args], { cwd: root, encoding: "utf8" });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`Prisma rechazó la propuesta:\n${result.stderr || result.stdout}`);
      return result.stdout;
    };
    run(["validate", "--config", join(root, "prisma7.config.ts"), "--schema", preview]);
    const sql = run(["migrate", "diff", "--config", join(root, "prisma7.config.ts"), "--from-schema", schemaDirectory, "--to-schema", preview, "--script"]);
    if (/\bDROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)\b|\bTRUNCATE\b/i.test(sql)) throw new Error("La propuesta contiene eliminaciones SQL; requiere un flujo de revisión distinto.");
    files["migration.preview.sql"] = `-- Review only. Not an applied migration.\n${sql}`;
    return files;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
