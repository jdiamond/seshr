import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const sessionPath = join(root, "test/fixtures/branched-session.jsonl");

test("review --since sends only in-range events with explicit branch structure and coverage", async () => {
  const temp = await mkdtemp(join(tmpdir(), "seshr-review-test-"));
  try {
    const binDir = join(temp, "bin");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(binDir));
    const capturePath = join(temp, "prompt.txt");
    const fakePi = join(binDir, "pi");
    await writeFile(fakePi, "#!/bin/sh\nprintf '%s\\n' \"$@\" >> \"$SESHR_TEST_PROMPT\"\nprintf '\\n---PROMPT---\\n' >> \"$SESHR_TEST_PROMPT\"\nprintf 'Mock review output\\n'\n", "utf8");
    await chmod(fakePi, 0o755);
    const outputPath = join(temp, "review.md");
    const result = spawnSync(process.execPath, [
      join(root, "src/cli.ts"), "review", "--session", sessionPath, "--output", outputPath,
      "--since", "2026-09-25T12:00:04.000Z", "--chunk-chars", "100000",
    ], { encoding: "utf8", env: { ...process.env, PATH: `${binDir}:${process.env.PATH}`, SESHR_TEST_PROMPT: capturePath } });

    assert.equal(result.status, 0, result.stderr);
    const prompt = await readFile(capturePath, "utf8");
    const report = await readFile(outputPath, "utf8");
    assert.match(prompt, /Try approach left/);
    assert.match(prompt, /Left branch result/);
    assert.match(prompt, /Right branch result/);
    assert.match(prompt, /Branch 1/);
    assert.match(prompt, /Branch 2/);
    assert.doesNotMatch(prompt, /Start task|Shared setup|Try approach right/);
    assert.match(report, /Included.*3/i);
    assert.match(report, /Earlier.*3/i);
    assert.match(report, /2026-09-25T12:00:04.000Z/);
    assert.match(report, /Mock review output/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
