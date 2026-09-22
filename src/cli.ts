#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const DEFAULT_CHUNK_CHARS = 24_000;
const MAX_REVIEW_CHARS = 12_000;
const CHUNK_REVIEW_INSTRUCTION = `Update the draft review with the new evidence below. Incorporate genuinely new findings, preserve earlier findings that remain supported, remove unsupported claims, and consolidate overlapping points rather than repeating them. Return the complete current Markdown review, not commentary about the update.`;

const DEFAULT_REVIEWER = `You are reviewing a coding-agent session for seshr.

Produce a concise, big-picture Markdown review of the session evidence. This is not an audit or a play-by-play transcript. Do not enumerate every file read, edited, or written, or every routine command. Summarize file and command activity only when it reveals meaningful work, a decision, a failure, a user preference, a reusable workflow, or an unresolved issue. Separate direct observations from suggestions. Every important observation or suggestion must cite the source entry number in the form [entry N]. Do not invent facts, and do not claim that a suggested change was made.

Use exactly these sections:
## Summary
## Observed
## Suggested
## Open questions

Observed should cover the session's purpose, major work and decisions, user preferences or corrections, meaningful commands/tests and failures, and unresolved work when present. Suggested should only contain durable workflow improvements that are supported by the session. Prefer synthesis and patterns over exhaustive detail. Avoid repeating the same point across sections unless the repetition adds necessary context.`;

type JsonObject = Record<string, any>;
type Entry = { line: number; value: JsonObject };

function usage(): never {
  console.error(`Usage: seshr review --session <path> --output <path> [options]

Options:
  --session <path>       Pi JSONL session file (required)
  --output <path>        Markdown output path (required)
  --chunk-chars <n>      Approximate chunk size, default ${DEFAULT_CHUNK_CHARS}
  --review-chars <n>     Maximum carried-forward review size, default ${MAX_REVIEW_CHARS}
  --model <model>        Model passed to pi
  --reviewer <path>      File containing a replacement reviewer system prompt
  --debug-dir <path>     Save prompts/reviews as chunk-NNN.prompt.md/review.md
  --verbose              Log review progress to stderr
  --help                 Show this help`);
  process.exit(1);
}

function options(argv: string[]) {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(usageText());
      process.exit(0);
    }
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (key === "verbose") {
      result[key] = "true";
      continue;
    }
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    result[key] = value;
  }
  if (!result.session || !result.output) usage();
  return result;
}

function usageText() {
  return `Usage: seshr review --session <path> --output <path> [options]

Options:
  --session <path>       Pi JSONL session file (required)
  --output <path>        Markdown output path (required)
  --chunk-chars <n>      Approximate chunk size, default ${DEFAULT_CHUNK_CHARS}
  --review-chars <n>     Maximum carried-forward review size, default ${MAX_REVIEW_CHARS}
  --model <model>        Model passed to pi
  --reviewer <path>      File containing a replacement reviewer system prompt
  --debug-dir <path>     Save prompts/reviews as chunk-NNN.prompt.md/review.md
  --verbose              Log review progress to stderr
  --help                 Show this help`;
}

function redact(text: string): string {
  return text
    .replace(/(Bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|token|secret|password|authorization)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi, "$1[REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, "[REDACTED]");
}

function textContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part && typeof part === "object" && (part.type === "text" || part.type === "input_text"))
    .map((part) => part.text ?? "")
    .join("\n");
}

function toolSummary(message: JsonObject): string {
  const parts = Array.isArray(message.content) ? message.content : [];
  const calls = parts.filter((part) => part?.type === "toolCall");
  return calls.map((call) => {
    const args = call.arguments ?? {};
    if (call.name === "bash" || call.name === "powershell") return `${call.name}: ${args.command ?? args.script ?? ""}`;
    if (args.path) return `${call.name ?? "tool"}: ${args.path}`;
    return `${call.name ?? "tool"}: ${JSON.stringify(args)}`;
  }).join("\n");
}

function toolResultSummary(message: JsonObject): string {
  const text = textContent(message.content);
  if (!message.isError && !/\b(error|failed|failure|exit code [1-9])\b/i.test(text)) return "";
  return `${message.toolName ?? "tool"} result${message.isError ? " (error)" : ""}: ${redact(text).slice(0, 2_000)}`;
}

function renderEntry(entry: Entry): string {
  const value = entry.value;
  if (value.type === "session") {
    return `[entry ${entry.line}] Session: ${value.id ?? "unknown"} (${value.cwd ?? "unknown cwd"})`;
  }
  if (value.type === "message") {
    const message = value.message ?? {};
    const role = message.role ?? "unknown";
    const isToolResult = role === "tool" || role === "toolResult";
    const text = isToolResult ? "" : textContent(message.content);
    const details = role === "assistant" ? toolSummary(message) : isToolResult ? toolResultSummary(message) : "";
    const rendered = [text.trim(), details].filter(Boolean).join("\n");
    if (!rendered) return "";
    return `[entry ${entry.line}] ${role}:\n${redact(rendered)}`;
  }
  return "";
}

async function readEntries(path: string): Promise<Entry[]> {
  const source = await readFile(path, "utf8");
  const entries: Entry[] = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      entries.push({ line: index + 1, value: JSON.parse(line) });
    } catch {
      throw new Error(`Invalid JSON at ${path}:${index + 1}`);
    }
  }
  return entries;
}

function chunks(entries: Entry[], maxChars: number): string[] {
  const result: string[] = [];
  let current = "";
  for (const entry of entries) {
    const rendered = renderEntry(entry);
    if (!rendered) continue;
    if (current && current.length + rendered.length + 2 > maxChars) {
      result.push(current);
      current = "";
    }
    // Keep a single oversized entry intact rather than silently dropping evidence.
    current += (current ? "\n\n" : "") + rendered;
  }
  if (current) result.push(current);
  return result;
}

function runPi(prompt: string, systemPrompt: string, model?: string): Promise<string> {
  const args = ["-p", "--no-session", "--no-tools", "--no-extensions", "--no-skills", "--no-context-files", "--thinking", "off", "--system-prompt", systemPrompt];
  if (model) args.push("--model", model);
  args.push("--", prompt);
  return new Promise((resolvePromise, reject) => {
    const child = spawn("pi", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (data) => (stdout += data));
    child.stderr.setEncoding("utf8").on("data", (data) => (stderr += data));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(stdout.trim());
      else reject(new Error(`pi exited with ${code}: ${stderr.trim() || "unknown error"}`));
    });
  });
}

async function main() {
  const command = process.argv[2];
  if (command === "--help" || command === "-h") {
    console.log(usageText());
    return;
  }
  if (command !== "review") usage();
  const flags = options(process.argv.slice(3));
  const sessionPath = resolve(flags.session);
  const outputPath = resolve(flags.output);
  const maxChars = Number(flags["chunk-chars"] ?? DEFAULT_CHUNK_CHARS);
  const maxReviewChars = Number(flags["review-chars"] ?? MAX_REVIEW_CHARS);
  if (!Number.isInteger(maxChars) || maxChars < 1) throw new Error("--chunk-chars must be a positive integer");
  if (!Number.isInteger(maxReviewChars) || maxReviewChars < 1) throw new Error("--review-chars must be a positive integer");

  const entries = await readEntries(sessionPath);
  const session = entries.find((entry) => entry.value.type === "session")?.value;
  const renderedChunks = chunks(entries, maxChars);
  if (!renderedChunks.length) throw new Error("Session contains no reviewable messages");
  const systemPrompt = flags.reviewer ? await readFile(resolve(flags.reviewer), "utf8") : DEFAULT_REVIEWER;
  const debugDir = flags["debug-dir"] ? resolve(flags["debug-dir"]) : undefined;
  if (debugDir) {
    await mkdir(debugDir, { recursive: true });
    await writeFile(resolve(debugDir, "system-prompt.md"), systemPrompt, "utf8");
  }
  const verbose = flags.verbose === "true";
  const log = (message: string) => {
    if (verbose) console.error(`[seshr] ${message}`);
  };
  let review = "(No review has been written yet.)";
  log(`session ${session?.id ?? basename(sessionPath)}: ${entries.length} JSONL entries, ${renderedChunks.length} chunk(s)`);
  log(`reviewer model: ${flags.model ?? "Pi default model"}`);

  const totalStart = performance.now();
  for (let index = 0; index < renderedChunks.length; index++) {
    const eventCount = renderedChunks[index].match(/\[entry \d+\]/g)?.length ?? 0;
    log(`sending ${eventCount} events (${renderedChunks[index].length} bytes), chunk ${index + 1}/${renderedChunks.length}`);
    const reviewSoFar = review.length > maxReviewChars
      ? review.slice(0, maxReviewChars) + "\n\n[review truncated to stay within the prompt budget]"
      : review;
    const prompt = `Session: ${session?.id ?? basename(sessionPath)}\nWorking directory: ${session?.cwd ?? "unknown"}\nChunk ${index + 1} of ${renderedChunks.length}\n\n${CHUNK_REVIEW_INSTRUCTION}\n\nREVIEW SO FAR:\n${reviewSoFar}\n\nNEW SESSION EVIDENCE:\n${renderedChunks[index]}`;
    if (debugDir) {
      const promptPath = resolve(debugDir, `chunk-${String(index + 1).padStart(3, "0")}.prompt.md`);
      await writeFile(promptPath, prompt + "\n", "utf8");
      log(`saved ${promptPath}`);
    }
    const runStart = performance.now();
    review = await runPi(prompt, systemPrompt, flags.model);
    const elapsedMs = Math.round(performance.now() - runStart);
    if (!review) throw new Error("pi returned an empty review");
    log(`agent run took ${elapsedMs} ms; new review is ${review.length} bytes`);
    if (debugDir) {
      const debugPath = resolve(debugDir, `chunk-${String(index + 1).padStart(3, "0")}.review.md`);
      await writeFile(debugPath, review + "\n", "utf8");
      log(`saved ${debugPath}`);
    }
  }
  log(`review complete in ${Math.round(performance.now() - totalStart)} ms`);

  const header = `# Session review\n\n- **Session:** \`${session?.id ?? basename(sessionPath)}\`\n- **Source:** \`${sessionPath}\`\n- **Working directory:** \`${session?.cwd ?? "unknown"}\`\n\n`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, header + review.trim() + "\n", "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(`seshr: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
