// Run: node --test src/lib/overlap.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { overlaps } from "./overlap.ts";

const h = (hour: number) => hour * 3_600_000;

test("[start,end) — the spec's boundary case", () => {
  // Room booked 09:00–10:00:
  assert.equal(overlaps(h(9), h(10), h(10), h(11)), false); // 10:00–11:00 succeeds
  assert.equal(overlaps(h(9), h(10), h(9.5), h(10.5)), true); // 09:30–10:30 fails
  assert.equal(overlaps(h(9), h(10), h(8), h(9)), false); // back-to-back before is fine
  assert.equal(overlaps(h(9), h(10), h(8), h(12)), true); // containment
  assert.equal(overlaps(h(9), h(10), h(9), h(10)), true); // identical slot
});
