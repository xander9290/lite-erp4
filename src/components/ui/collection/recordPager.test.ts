import assert from "node:assert/strict";
import test from "node:test";
import { recordPagerFor, rememberCollectionPage } from "./recordPager";

function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test("the pager follows the remembered page order and stops at its edges", () => {
  const storage = memory();
  rememberCollectionPage("/erp/a/b?sort=name", ["r1", "r2", "r3"], storage);
  assert.deepEqual(recordPagerFor("/erp/a/b?sort=name", "r1", storage), { position: 1, total: 3, next: "r2" });
  assert.deepEqual(recordPagerFor("/erp/a/b?sort=name", "r2", storage), { position: 2, total: 3, previous: "r1", next: "r3" });
  assert.deepEqual(recordPagerFor("/erp/a/b?sort=name", "r3", storage), { position: 3, total: 3, previous: "r2" });
});

test("pages are told apart by their exact URL and the latest load wins", () => {
  const storage = memory();
  rememberCollectionPage("/erp/a/b", ["r1", "r2"], storage);
  rememberCollectionPage("/erp/a/b?page=2", ["r3", "r4"], storage);
  assert.equal(recordPagerFor("/erp/a/b", "r3", storage), null);
  assert.equal(recordPagerFor("/erp/a/b?page=2", "r3", storage)?.next, "r4");
  rememberCollectionPage("/erp/a/b", ["r2", "r1"], storage);
  assert.deepEqual(recordPagerFor("/erp/a/b", "r2", storage), { position: 1, total: 2, next: "r1" });
});

test("no pager without a remembered page, for a single record or for unsafe input", () => {
  const storage = memory();
  assert.equal(recordPagerFor("/erp/a/b", "r1", storage), null);
  rememberCollectionPage("/erp/a/b", ["r1"], storage);
  assert.equal(recordPagerFor("/erp/a/b", "r1", storage), null);
  rememberCollectionPage("https://example.com/x", ["r1", "r2"], storage);
  assert.equal(recordPagerFor("https://example.com/x", "r1", storage), null);
  assert.equal(recordPagerFor(null, "r1", storage), null);
  assert.equal(recordPagerFor("/erp/a/b", undefined, storage), null);
  storage.setItem("lite-erp:record-pages", "{no es json");
  assert.equal(recordPagerFor("/erp/a/b", "r1", storage), null);
  assert.equal(recordPagerFor("/erp/a/b", "r1", null), null);
});

test("only the twenty most recent pages are kept", () => {
  const storage = memory();
  for (let page = 1; page <= 21; page++) rememberCollectionPage(`/erp/a/b?page=${page}`, [`a${page}`, `b${page}`], storage);
  assert.equal(recordPagerFor("/erp/a/b?page=1", "a1", storage), null);
  assert.equal(recordPagerFor("/erp/a/b?page=2", "a2", storage)?.next, "b2");
});
