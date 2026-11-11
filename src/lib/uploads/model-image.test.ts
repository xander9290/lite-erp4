import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { Fields } from "../orm/fields";
import { AccessError } from "../auth/policy";
import { createModelImageSigner } from "./model-image.server";
import { createCloudinaryImageUploader, createSignedCloudinaryImageUploader } from "./cloudinary";
import type { CloudinaryImageSignatureResult } from "./cloudinary-signature";

const model = { metadata: {
  logo: Fields.Image({ folder: "tests/logos" }).metadata,
  hidden: Fields.Image({ folder: "tests/hidden" }).metadata,
  secret: Fields.Image({ folder: "tests/private", sensitive: true }).metadata,
  name: Fields.Text().metadata,
} };
const getConfig = () => ({ cloudName: "test-cloud", apiKey: "123456", apiSecret: "fixture-secret-never-real" });

test("model image signing authorizes every call and fixes folder, formats and unique non-overwriting IDs", async () => {
  let calls = 0;
  const sign = createModelImageSigner({ authorize: async () => { calls++; }, getConfig }, model, ["logo", "secret", "name"]);
  const first = await sign("logo"), second = await sign("logo");
  assert.ok(first.ok && second.ok);
  assert.equal(first.data.parameters.asset_folder, "tests/logos");
  assert.equal(first.data.parameters.folder, undefined);
  assert.equal(first.data.parameters.overwrite, "false");
  assert.equal(first.data.parameters.allowed_formats, "jpg,png,webp");
  assert.notEqual(first.data.parameters.public_id, second.data.parameters.public_id);
  const payload = Object.entries(first.data.parameters).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
  assert.equal(first.data.signature, createHash("sha256").update(payload + getConfig().apiSecret).digest("hex"));
  assert.equal(JSON.stringify(first).includes(getConfig().apiSecret), false);
  for (const input of ["hidden", "secret", "name", "constructor", "__proto__", "other", { folder: "attacker" }]) assert.equal((await sign(input)).ok, false);
  assert.equal(calls, 9);
  const fixed = await createModelImageSigner({ authorize: async () => {}, getConfig: () => ({ ...getConfig(), folderMode: "fixed" }) }, model, ["logo"])("logo");
  assert.ok(fixed.ok); assert.equal(fixed.data.parameters.folder, "tests/logos"); assert.equal(fixed.data.parameters.asset_folder, undefined);
  const preset = await createModelImageSigner({ authorize: async () => {}, getConfig: () => ({ ...getConfig(), uploadPreset: "signed-images" }) }, model, ["logo"])("logo");
  assert.ok(preset.ok); assert.equal(preset.data.parameters.upload_preset, "signed-images");
  const denied = createModelImageSigner({ authorize: async () => { throw new AccessError("FORBIDDEN"); }, getConfig: () => { throw new Error("should never read credentials"); } }, model, ["logo"]);
  assert.equal((await denied("logo")).ok, false);
  const misconfigured = createModelImageSigner({ authorize: async () => {}, getConfig: () => ({ cloudName: "", apiKey: "", apiSecret: "" }) }, model, ["logo"]);
  const result = await misconfigured("logo");
  assert.ok(!result.ok); assert.match(result.error, /CLOUDINARY_API_SECRET/);
});

test("Cloudinary upload transport preserves progress, signed parameters, failures and cancellation without network", async () => {
  class Request {
    static sent: Request[] = [];
    upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
    status = 200;
    response = { secure_url: "https://images.example.test/logo.webp" };
    body?: FormData;
    url?: string;
    responseType = "";
    timeout = 0;
    onload?: () => void;
    onerror?: () => void;
    ontimeout?: () => void;
    onabort?: () => void;
    open(method: string, url: string) { assert.equal(method, "POST"); this.url = url; }
    send(body: FormData) { this.body = body; Request.sent.push(this); }
    abort() { this.onabort?.(); }
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, "XMLHttpRequest");
  Object.defineProperty(globalThis, "XMLHttpRequest", { configurable: true, value: Request });
  try {
    const sign = createModelImageSigner({ authorize: async () => {}, getConfig }, model, ["logo"]);
    const signed = await sign("logo"); assert.ok(signed.ok);
    const file = new File(["fixture-image"], "image.webp", { type: "image/webp" });
    const progress: number[] = [];
    const controller = new AbortController();
    const upload = createSignedCloudinaryImageUploader(async () => signed);
    const promise = upload(file, { signal: controller.signal, onProgress: n => progress.push(n) });
    await Promise.resolve();
    const request = Request.sent.at(-1)!;
    assert.match(request.url!, /test-cloud\/image\/upload$/);
    assert.equal(request.body?.get("asset_folder"), "tests/logos");
    assert.equal(request.body?.get("signature"), signed.data.signature);
    assert.equal(request.body?.get("upload_preset"), null);
    assert.equal(request.body?.get("overwrite"), "false");
    request.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    request.onload?.();
    assert.equal(await promise, request.response.secure_url);
    assert.deepEqual(progress, [50, 100]);

    const unsigned = createCloudinaryImageUploader({ cloudName: "test-cloud", uploadPreset: "legacy", folder: "legacy/avatars" });
    const legacy = unsigned(file, { signal: controller.signal, onProgress: () => {} });
    assert.equal(Request.sent.at(-1)!.body?.get("upload_preset"), "legacy");
    Request.sent.at(-1)!.onload?.(); await legacy;

    const failed = upload(file, { signal: controller.signal, onProgress: () => {} });
    await Promise.resolve(); Request.sent.at(-1)!.onerror?.();
    await assert.rejects(failed, /conectar/);
    const invalidUrl = upload(file, { signal: controller.signal, onProgress: () => {} });
    await Promise.resolve(); Request.sent.at(-1)!.response.secure_url = "http://example.test/a"; Request.sent.at(-1)!.onload?.();
    await assert.rejects(invalidUrl, /HTTPS/);

    let resolveSign!: (value: CloudinaryImageSignatureResult) => void;
    const delayed = createSignedCloudinaryImageUploader(() => new Promise(resolve => { resolveSign = resolve; }));
    const count = Request.sent.length;
    const cancelled = delayed(file, { signal: controller.signal, onProgress: () => {} });
    controller.abort(); controller.abort(); resolveSign(signed);
    await assert.rejects(cancelled, { name: "AbortError" });
    assert.equal(Request.sent.length, count);
    await assert.rejects(upload(file, { signal: controller.signal, onProgress: () => {} }), { name: "AbortError" });
    const inFlight = new AbortController();
    const pending = upload(file, { signal: inFlight.signal, onProgress: () => {} });
    await Promise.resolve(); inFlight.abort(); inFlight.abort();
    await assert.rejects(pending, { name: "AbortError" });
    await assert.rejects(createSignedCloudinaryImageUploader(async () => ({ ok: false, error: "Sin acceso" }))(file, { signal: new AbortController().signal, onProgress: () => {} }), /Sin acceso/);
  } finally {
    if (original) Object.defineProperty(globalThis, "XMLHttpRequest", original);
    else Reflect.deleteProperty(globalThis, "XMLHttpRequest");
  }
});
