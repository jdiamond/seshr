import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSessionTree, partitionTreeEvidence } from "../src/session.ts";

type Entry = { line: number; value: Record<string, any> };

async function fixtureEntries(): Promise<Entry[]> {
  const source = await readFile(new URL("./fixtures/branched-session.jsonl", import.meta.url), "utf8");
  return source.trim().split(/\r?\n/).map((line, index) => ({ line: index + 1, value: JSON.parse(line) }));
}

function ids(entries: Entry[]) {
  return entries.map((entry) => entry.value.id);
}

test("keeps shared ancestry once and separates alternate branch paths", async () => {
  const tree = buildSessionTree(await fixtureEntries());
  const evidence = partitionTreeEvidence(tree);

  assert.deepEqual(ids(evidence.shared), ["u-root", "a-root"]);
  assert.deepEqual(evidence.branches.map((branch: { leaf: Entry; entries: Entry[] }) => ({
    leaf: branch.leaf.value.id,
    entries: ids(branch.entries),
  })), [
    { leaf: "a-left", entries: ["u-left", "a-left"] },
    { leaf: "a-right", entries: ["u-right", "a-right"] },
  ]);
});

test("filters shared and branch-specific evidence without merging branch order", async () => {
  const entries = await fixtureEntries();
  const tree = buildSessionTree(entries);
  const included = new Set(["u-left", "a-left", "a-right"]);
  const evidence = partitionTreeEvidence(tree, (entry: Entry) => included.has(entry.value.id));

  assert.deepEqual(ids(evidence.shared), []);
  assert.deepEqual(evidence.branches.map((branch: { entries: Entry[] }) => ids(branch.entries)), [
    ["u-left", "a-left"],
    ["a-right"],
  ]);
});

test("represents a linear session as one path", async () => {
  const entries = await fixtureEntries();
  const linear = entries.filter((entry) => !["u-right", "a-right"].includes(entry.value.id));
  const tree = buildSessionTree(linear);
  const evidence = partitionTreeEvidence(tree);

  assert.deepEqual(ids(evidence.shared), []);
  assert.equal(evidence.branches.length, 1);
  assert.deepEqual(ids(evidence.branches[0].entries), ["u-root", "a-root", "u-left", "a-left"]);
});
