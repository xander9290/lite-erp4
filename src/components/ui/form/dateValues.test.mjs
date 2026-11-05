import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import test from "node:test";

const { createFieldDateFormat } = createRequire(import.meta.url)("./dateValues.ts");

function inTimezone(timezone, body) {
  const path = new URL("./dateValues.ts", import.meta.url).pathname;
  const result = spawnSync(process.execPath, ["-e", `const assert = require('node:assert/strict'); const { createFieldDateFormat } = require(${JSON.stringify(path)}); ${body}`], {
    env: { ...process.env, TZ: timezone }, encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
}

test("calendar dates preserve the written day across timezones, including ISO defaults", () => {
  for (const timezone of ["UTC", "America/Mexico_City", "Asia/Kolkata", "Pacific/Kiritimati"]) {
    inTimezone(timezone, `
      const date = createFieldDateFormat();
      assert.equal(date.toInput('2026-11-01T00:00:00.000Z'), '2026-11-01');
      assert.equal(date.fromInput('2026-11-01').value, '2026-11-01');
      const iso = createFieldDateFormat({ valueFormat: 'iso' });
      assert.equal(iso.fromInput('2026-11-01').value, '2026-11-01T00:00:00.000Z');
    `);
  }
});

test("calendar validation handles leap years and rejects rolled-over dates", () => {
  const date = createFieldDateFormat();
  assert.equal(date.normalize("2024-02-29"), "2024-02-29");
  for (const value of ["2026-02-29", "1900-02-29", "2026-04-31", "0000-01-01", "invalid"]) {
    assert.ok(date.validate(value), value);
  }
  assert.equal(date.fromInput("").value, null);
  assert.equal(date.validate(null), null);
  assert.ok(date.validate(null, true));
});

test("date bounds are inclusive and invalid configuration fails explicitly", () => {
  const date = createFieldDateFormat({ min: "2026-01-01", max: "2026-12-31" });
  assert.equal(date.validate("2026-01-01"), null);
  assert.equal(date.validate("2026-12-31"), null);
  assert.ok(date.validate("2025-12-31"));
  assert.ok(date.validate("2027-01-01"));
  assert.throws(() => createFieldDateFormat({ min: "invalid" }), RangeError);
  assert.throws(() => createFieldDateFormat({ min: "2026-12-31", max: "2026-01-01" }), RangeError);
});

test("ranges validate order, required endpoints and derive opposite input bounds", () => {
  const date = createFieldDateFormat();
  assert.equal(date.validateRange({ start: "2026-11-01", end: "2026-11-01" }), null);
  assert.equal(date.validateRange({ start: "2026-11-01", end: null }), null);
  assert.equal(date.validateRange({ start: "2026-11-01", end: null }, true).endpoint, "end");
  assert.equal(date.validateRange({ start: "2026-11-02", end: "2026-11-01" }).endpoint, "end");
  assert.ok(date.validateRange({ start: 123, end: null }));
  assert.deepEqual(date.inputBounds("end", { start: "2026-11-01", end: null }), { min: "2026-11-01", max: undefined });
});

test("datetime displays browser local time and returns the corresponding UTC instant", () => {
  inTimezone("America/Mexico_City", `
    const date = createFieldDateFormat({ type: 'datetime' });
    assert.equal(date.toInput('2026-11-01T18:30:00.000Z'), '2026-11-01T12:30');
    assert.equal(date.fromInput('2026-11-01T12:30').value, '2026-11-01T18:30:00.000Z');
    assert.equal(date.toInput('2026-11-01T00:30:00Z'), '2026-10-31T18:30');
    assert.equal(date.normalize('2026-11-01T12:30:00-06:00'), '2026-11-01T18:30:00.000Z');
  `);
  inTimezone("Asia/Kolkata", `
    const date = createFieldDateFormat({ type: 'datetime' });
    assert.equal(date.toInput('2026-11-01T18:30:00.000Z'), '2026-11-02T00:00');
    assert.equal(date.fromInput('2026-11-02T00:00').value, '2026-11-01T18:30:00.000Z');
  `);
});

test("datetime retains seconds, milliseconds and early calendar years", () => {
  inTimezone("UTC", `
    const date = createFieldDateFormat({ type: 'datetime' });
    assert.equal(date.fromInput('2026-11-01T12:30:45.125').value, '2026-11-01T12:30:45.125Z');
    assert.equal(date.toInput('2026-11-01T12:30:45.125Z'), '2026-11-01T12:30:45.125');
    assert.equal(date.fromInput('0099-01-01T12:00').value, '0099-01-01T12:00:00.000Z');
  `);
});

test("DST gaps are rejected and existing repeated-hour instants are preserved", () => {
  inTimezone("America/New_York", `
    const date = createFieldDateFormat({ type: 'datetime' });
    assert.ok(date.fromInput('2026-03-08T02:30').error);
    assert.equal(date.normalize('2026-03-08T02:30'), null);
    assert.equal(date.toInput('2026-11-01T06:30:00.000Z'), '2026-11-01T01:30');
    assert.equal(date.fromInput('2026-11-01T01:30', '2026-11-01T06:30:00.000Z').value, '2026-11-01T06:30:00.000Z');
  `);
});

test("datetime ranges compare instants after normalizing timezone offsets", () => {
  const date = createFieldDateFormat({ type: "datetime" });
  assert.equal(date.validateRange({ start: "2026-11-01T12:00:00-06:00", end: "2026-11-01T18:00:00Z" }), null);
  assert.ok(date.validateRange({ start: "2026-11-01T12:00:00-06:00", end: "2026-11-01T17:00:00Z" }));
});

test("compact calendar labels are Spanish and preserve dates across timezone changes", () => {
  for (const timezone of ["UTC", "America/Mexico_City", "Asia/Kolkata", "Pacific/Apia"]) {
    inTimezone(timezone, `
      const date = createFieldDateFormat();
      assert.equal(date.toDisplay('2026-11-02'), '2 nov');
      assert.equal(date.toDisplay('2026-11-02T00:00:00.000Z'), '2 nov');
      assert.equal(date.toDisplay('2026-01-01'), '1 ene');
      assert.equal(date.toDisplay('2011-12-30'), '30 dic');
      assert.equal(date.toDisplay(null), '');
      assert.equal(date.toDisplay('2026-02-29'), '');
    `);
  }
});

test("compact datetime labels use local time, twelve-hour format and spaced Spanish periods", () => {
  inTimezone("America/Mexico_City", `
    const date = createFieldDateFormat({ type: 'datetime' });
    assert.equal(date.toDisplay('2026-11-03T02:46:00.000Z'), '2 nov, 08:46 p. m.');
    assert.equal(date.toDisplay('2026-11-02T06:05:00.000Z'), '2 nov, 12:05 a. m.');
    assert.equal(date.toDisplay('2026-11-02T18:00:00.000Z'), '2 nov, 12:00 p. m.');
    assert.equal(date.toDisplay('2026-11-02T20:46'), '2 nov, 08:46 p. m.');
    assert.equal(date.toDisplay(null), '');
    assert.equal(date.toDisplay('invalid'), '');
  `);
  inTimezone("Asia/Kolkata", `
    const date = createFieldDateFormat({ type: 'datetime' });
    assert.equal(date.toDisplay('2026-11-02T20:46:00.000Z'), '3 nov, 02:16 a. m.');
  `);
});
