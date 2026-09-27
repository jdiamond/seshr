import test from "node:test";
import assert from "node:assert/strict";
import { buildSessionTree, parseSince, selectEventsSince } from "../src/session.ts";
import { readFile } from "node:fs/promises";

type Entry = { line: number; value: Record<string, any> };

async function fixtureEntries(): Promise<Entry[]> {
  const source = await readFile(new URL("./fixtures/branched-session.jsonl", import.meta.url), "utf8");
  return source.trim().split(/\r?\n/).map((line, index) => ({ line: index + 1, value: JSON.parse(line) }));
}

test("selects events by timestamp, not file order, across all branches", async () => {
  const entries = await fixtureEntries();
  const cutoff = Date.parse("2026-09-25T12:00:04.000Z");
  const result = selectEventsSince(entries, cutoff);

  assert.deepEqual(result.selected.map((entry: Entry) => entry.value.id).sort(), ["a-left", "a-right", "u-left"]);
  assert.deepEqual(result.before.map((entry: Entry) => entry.value.id), ["u-root", "a-root", "u-right"]);
  assert.deepEqual(result.missingTimestamp, []);
});

test("reports events after the review-time upper bound separately", async () => {
  const entries = await fixtureEntries();
  entries.push({ line: 8, value: { type: "message", id: "future", parentId: "a-right", timestamp: "2030-01-01T00:00:00.000Z" } });
  const result = selectEventsSince(entries, Date.parse("2026-09-25T12:00:04.000Z"), Date.parse("2026-09-25T12:00:10.000Z"));

  assert.deepEqual(result.after.map((entry: Entry) => entry.value.id), ["future"]);
  assert.equal(result.selected.some((entry: Entry) => entry.value.id === "future"), false);
});

test("counts events with missing or invalid timestamps separately", async () => {
  const entries = await fixtureEntries();
  entries.push({ line: 8, value: { type: "message", id: "no-time", parentId: "a-right" } });
  entries.push({ line: 9, value: { type: "message", id: "bad-time", parentId: "no-time", timestamp: "not-a-date" } });
  const result = selectEventsSince(entries, Date.parse("2026-09-25T12:00:00.000Z"));

  assert.deepEqual(result.missingTimestamp.map((entry: Entry) => entry.value.id), ["no-time", "bad-time"]);
});

test("parses yesterday as the start of the previous local calendar day", () => {
  const now = new Date(2026, 8, 27, 0, 0, 0, 0);
  const expected = new Date(2026, 8, 26, 0, 0, 0, 0).getTime();
  assert.equal(parseSince("yesterday", now), expected);
});

test("parses today as the start of the current local calendar day", () => {
  const now = new Date(2026, 8, 27, 13, 14, 15, 0);
  const expected = new Date(2026, 8, 27, 0, 0, 0, 0).getTime();
  assert.equal(parseSince("today", now), expected);
});

test("parses rolling durations relative to the supplied current time", () => {
  const now = new Date("2026-09-27T12:00:00.000Z");
  assert.equal(parseSince("6h", now), now.getTime() - 6 * 60 * 60 * 1000);
});

test("preserves tree paths while selecting recent evidence", async () => {
  const entries = await fixtureEntries();
  const result = selectEventsSince(entries, Date.parse("2026-09-25T12:00:04.000Z"));
  const tree = buildSessionTree(entries);
  const selectedIds = new Set(result.selected.map((entry: Entry) => entry.value.id));
  const selectedPaths = tree.paths.map((path: Entry[]) => path.filter((entry) => selectedIds.has(entry.value.id)).map((entry) => entry.value.id));

  assert.deepEqual(selectedPaths, [["u-left", "a-left"], ["a-right"]]);
});
