import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { hashPassword } from "../src/lib/auth/password";
import { saveOwnTheme } from "../src/lib/auth/theme-service";

config({ path: ".env.local", quiet: true }); config({ quiet: true });
const { prisma } = await import("../src/lib/prisma");
const base = process.env.TEST_AUTH_URL ?? "http://localhost:3000";
const fixtureIds: string[] = [];
const password = randomUUID();
const cookieJar = new Map<string, string>();

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("cookie", [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; "));
  const response = await fetch(new URL(path, base), { ...options, headers, redirect: "manual" });
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";"); const i = pair.indexOf("=");
    if (/max-age=0/i.test(cookie)) cookieJar.delete(pair.slice(0, i)); else cookieJar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  return response;
}

async function login(login: string) {
  const { csrfToken } = await (await request("/api/auth/csrf")).json();
  const result = await (await request("/api/auth/callback/credentials", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-auth-return-redirect": "1", origin: base },
    body: new URLSearchParams({ login, password, csrfToken, callbackUrl: `${base}/erp` }),
  })).json();
  assert.equal(result.url, `${base}/erp`);
}

try {
  const hash = await hashPassword(password);
  for (let i = 0; i < 2; i++) {
    const user = await prisma.user.create({ data: { login: `theme_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`, password: hash } });
    fixtureIds.push(user.id);
  }
  const original = await prisma.user.findUniqueOrThrow({ where: { id: fixtureIds[0] } });
  const other = await prisma.user.findUniqueOrThrow({ where: { id: fixtureIds[1] } });
  const actor = { id: original.id, sessionVersion: original.sessionVersion };
  assert.equal(original.darkMode, false);
  await login(original.login);
  assert.equal((await (await request("/api/auth/session")).json()).user.darkMode, false);
  const beforeTheme = await prisma.user.findUniqueOrThrow({ where: { id: original.id } });

  await saveOwnTheme(prisma, actor, true);
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: original.id } }), { ...beforeTheme, darkMode: true });
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: other.id } }), other);
  // Existing sessions and new logins read the database rather than a stale token value.
  assert.equal((await (await request("/api/auth/session")).json()).user.darkMode, true);
  cookieJar.clear(); await login(original.login);
  assert.equal((await (await request("/api/auth/session")).json()).user.darkMode, true);
  const darkPage = await request("/erp");
  assert.equal(darkPage.status, 200);
  assert.match(await darkPage.text(), /<div data-theme="dark"/);

  for (const invalid of [null, "false", 1, { darkMode: true, id: other.id }]) await assert.rejects(saveOwnTheme(prisma, actor, invalid));
  await assert.rejects(saveOwnTheme(prisma, { ...actor, sessionVersion: actor.sessionVersion + 1 }, false));
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: original.id } })).darkMode, true);

  await saveOwnTheme(prisma, actor, false);
  assert.equal((await (await request("/api/auth/session")).json()).user.darkMode, false);
  assert.match(await (await request("/erp")).text(), /<div data-theme="corporate"/);
  await prisma.user.update({ where: { id: original.id }, data: { active: false } });
  await assert.rejects(saveOwnTheme(prisma, actor, true));
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: original.id } })).darkMode, false);
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: other.id } }), other);
  console.log("Theme integration passed: persistence, account isolation, session reload, initial HTML and rejected invalid/revoked updates.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: fixtureIds } } });
  await prisma.$disconnect();
}
