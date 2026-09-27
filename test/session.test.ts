import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSessionTree } from "../src/session.ts";

type Entry = { line: number; value: Record<string, any> };

async function fixtureEntries(): Promise<Entry[]> {
  const source = await readFile(new URL("./fixtures/branched-session.jsonl", import.meta.url), "utf8");
  return source.trim().split(/\r?\n/).map((line, index) => ({ line: index + 1, value: JSON.parse(line) }));
}

test("reconstructs both branch paths and shared ancestry from parent links", async () => {
  const entries = await fixtureEntries();
  const tree = buildSessionTree(entries);

  assert.deepEqual(tree.errors, []);
  assert.equal(tree.roots.length, 1);
  assert.deepEqual(tree.leaves.map((leaf: Entry) => leaf.value.id).sort(), ["a-left", "a-right"]);
  assert.deepEqual(tree.paths.map((path: Entry[]) => path.map((entry) => entry.value.id)), [
    ["u-root", "a-root", "u-left", "a-left"],
    ["u-root", "a-root", "u-right", "a-right"],
  ]);
});

test("does not use JSONL order as conversational order", async () => {
  const entries = await fixtureEntries();
  const tree = buildSessionTree(entries);

  const leftPath = tree.paths.find((path: Entry[]) => path.at(-1)?.value.id === "a-left");
  assert.deepEqual(leftPath?.map((entry) => entry.value.id), ["u-root", "a-root", "u-left", "a-left"]);
});

test("reports missing parents and retains the orphan as a reviewable root", () => {
  const tree = buildSessionTree([
    { line: 1, value: { type: "message", id: "orphan", parentId: "missing", timestamp: "2026-01-01T00:00:00Z" } },
  ]);

  assert.match(tree.errors.join("\\n"), /missing parent missing/);
  assert.deepEqual(tree.paths.map((path: Entry[]) => path.map((entry) => entry.value.id)), [["orphan"]]);
});

test("reports cycles instead of silently losing cyclic entries", () => {
  const tree = buildSessionTree([
    { line: 1, value: { type: "message", id: "a", parentId: "b" } },
    { line: 2, value: { type: "message", id: "b", parentId: "a" } },
  ]);

  assert.match(tree.errors.join("\\n"), /cycle/i);
  assert.match(tree.errors.join("\\n"), /not reachable/);
});
