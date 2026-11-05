import assert from "node:assert/strict";
import test from "node:test";
import { partnerAvatarSource, partnerInitials } from "./partnerAvatarValues";

test("contact initials handle companies, accents, extra spaces and missing names", () => {
  for (const [name, initials] of [["Ana María López", "AL"], ["  José   Álvarez ", "JÁ"], ["Acme", "A"], ["Norte Comercial", "NC"], ["李 雷", "李雷"], ["—", "?"], ["", "?"]]) assert.equal(partnerInitials(name), initials);
});

test("avatar rendering rejects local blobs, executable URLs and URLs with credentials", () => {
  assert.equal(partnerAvatarSource("https://images.example.test/avatar.webp"), "https://images.example.test/avatar.webp");
  for (const value of [null, undefined, {}, "", "http://images.example.test/a.png", "//images.example.test/a.png", "javascript:alert(1)", "data:image/svg+xml,<svg/>", "blob:https://erp.local/file", "https://user:secret@images.example.test/a.png", "https://images.example.test/" + "a".repeat(2048)]) assert.equal(partnerAvatarSource(value), null);
});
