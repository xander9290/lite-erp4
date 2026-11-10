import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inverseText, removeInverse, sourceHash } from "./installation-state";
import { artifactPlan } from "./write";

test("managed inverse and schema ownership survive CRLF checkout but reject semantic edits and duplicate markers", () => {
  const text = inverseText("demo", "User", ['  records Demo[] @relation("creator")']);
  const source = `model User {\n  id String @id\n${text}}\n`;
  const windows = source.replace(/\n/g, "\r\n");
  assert.equal(sourceHash(windows), sourceHash(source));
  assert.equal(removeInverse(windows, { target: "User", text }).replace(/\r\n/g, "\n"), removeInverse(source, { target: "User", text }));
  assert.notEqual(sourceHash(source.replace("String", "Int")), sourceHash(source));
  assert.throws(() => removeInverse(windows.replace("records", "edited"), { target: "User", text }));
  assert.throws(() => removeInverse(source + text, { target: "User", text }));
});

test("artifact integrity accepts checkout line endings without updating hashes and still rejects edits", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orm-line-endings-"));
  try {
    const content = "export const answer = 42;\n";
    await writeFile(join(directory, "example.ts"), content.replace(/\n/g, "\r\n"));
    await writeFile(join(directory, "generation-manifest.json"), JSON.stringify({ generator: "lite-erp-orm-v1", module: "demo", files: { "example.ts": sourceHash(content) } }));
    assert.equal((await artifactPlan(directory, "demo", { "example.ts": content })).changes[0].action, "unchanged");
    await writeFile(join(directory, "example.ts"), content.replace("42", "43"));
    await assert.rejects(artifactPlan(directory, "demo", { "example.ts": content }), /modificado/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
