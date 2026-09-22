#!/usr/bin/env node

import { readFile, writeFile, mkdir, readdir, open } from "node:fs/promises";
import { basename, dirname, resolve, join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const DEFAULT_CHUNK_CHARS = 24_000;
const MAX_REVIEW_CHARS = 12_000;
const DEFAULT_SESSION_DIR = resolve(homedir(), ".pi/agent/sessions");
const DEFAULT_REVIEWER_PATH = new URL("../prompts/default-reviewer.md", import.meta.url);

type JsonObject = Record<string, any>;
type Entry = { line: number; value: JsonObject };
type SessionInfo = {
  path: string;
  id?: string;
  timestamp?: string;
  cwd?: string;
  error?: string;
};

function usage(): never {
  console.error(usageText());
  process.exit(1);
}

function options(argv: string[], required: string[] = ["session", "output"]) {
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
  if (required.some((key) => !result[key])) usage();
  return result;
}

function usageText() {
  return `Usage:
  seshr sessions [--since <age-or-timestamp>]
  seshr review --session <path> --output <path> [options]

Session options:
  --since <value>        Show sessions newer than a duration such as 1d, or a timestamp

Review options:
  --session <path>       Pi JSONL session file (required)
  --output <path>        Markdown output path (required)
  --chunk-chars <n>      Approximate chunk size, default ${DEFAULT_CHUNK_CHARS}
  --review-chars <n>     Maximum carried-forward review size, default ${MAX_REVIEW_CHARS}
  --model <model>        Model passed to pi
  --reviewer <path>      File replacing the default reviewer prompt
  --debug-dir <path>     Save prompts/reviews as chunk-NNN.prompt.md/review.md
  --verbose              Log review progress to stderr
  --help                 Show this help`;
}

function parseSince(value: string): number {
  const match = /^(\d+)([smhdw])$/i.exec(value);
  if (match) {
    const units: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
    return Date.now() - Number(match[1]) * units[match[2].toLowerCase()];
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new Error(`Invalid --since value: ${value}`);
  return timestamp;
}

async function readSessionHeader(path: string): Promise<SessionInfo> {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(16_384);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const line = buffer.toString("utf8", 0, bytesRead).split(/\r?\n/, 1)[0];
    const value = JSON.parse(line);
    if (value.type !== "session") throw new Error("first entry is not a session header");
    return { path, id: value.id, timestamp: value.timestamp, cwd: value.cwd };
  } catch (error) {
    return { path, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await handle.close();
  }
}

async function discoverSessions(since?: string): Promise<SessionInfo[]> {
  let directories;
  try {
    directories = await readdir(DEFAULT_SESSION_DIR, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Cannot read Pi session directory ${DEFAULT_SESSION_DIR}: ${error instanceof Error ? error.message : error}`);
  }
  const cutoff = since ? parseSince(since) : undefined;
  const sessions: SessionInfo[] = [];
  for (const directory of directories) {
    if (!directory.isDirectory()) continue;
    const directoryPath = join(DEFAULT_SESSION_DIR, directory.name);
    const files = await readdir(directoryPath, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".jsonl")) continue;
      const info = await readSessionHeader(join(directoryPath, file.name));
      if (cutoff !== undefined && info.timestamp && Date.parse(info.timestamp) < cutoff) continue;
      sessions.push(info);
    }
  }
  return sessions.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
}

function printSessions(sessions: SessionInfo[]) {
  if (!sessions.length) {
    console.log("No sessions found.");
    return;
  }
  console.log("ID\tTIMESTAMP\tWORKING DIRECTORY\tPATH");
  for (const session of sessions) {
    if (session.error) {
      console.log(`INVALID\t-\t${session.error}\t${session.path}`);
      continue;
    }
    console.log(`${session.id ?? "unknown"}\t${session.timestamp ?? "unknown"}\t${session.cwd ?? "unknown"}\t${session.path}`);
  }
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

function timestampMs(value: JsonObject): number | undefined {
  if (typeof value.timestamp === "number") return value.timestamp;
  if (typeof value.timestamp === "string") {
    const timestamp = Date.parse(value.timestamp);
    return Number.isNaN(timestamp) ? undefined : timestamp;
  }
  return undefined;
}

function interactionMetadata(entries: Entry[]): Map<number, string> {
  const metadata = new Map<number, string>();
  let span: {
    start: Entry;
    startTime?: number;
    toolTurns: number;
    toolCalls: number;
    failedCalls: number;
  } | undefined;

  for (const entry of entries) {
    const value = entry.value;
    if (value.type !== "message") continue;
    const message = value.message ?? {};
    const role = message.role;
    if (role === "user" && textContent(message.content).trim()) {
      span = {
        start: entry,
        startTime: timestampMs(value),
        toolTurns: 0,
        toolCalls: 0,
        failedCalls: 0,
      };
      continue;
    }
    if (!span) continue;
    if (role === "assistant") {
      const calls = Array.isArray(message.content)
        ? message.content.filter((part: JsonObject) => part?.type === "toolCall")
        : [];
      if (calls.length) {
        span.toolTurns++;
        span.toolCalls += calls.length;
      } else if (textContent(message.content).trim()) {
        const endTime = timestampMs(value);
        const elapsed = endTime !== undefined && span.startTime !== undefined
          ? `; ${Math.max(0, endTime - span.startTime)}ms elapsed`
          : "";
        metadata.set(span.start.line,
          `[interaction span: entries ${span.start.line}–${entry.line}; ${span.toolTurns} assistant tool turns; ${span.toolCalls} tool calls; ${span.failedCalls} failed calls${elapsed}]`);
        span = undefined;
      }
    } else if (role === "tool" || role === "toolResult") {
      if (message.isError) span.failedCalls++;
    }
  }
  return metadata;
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
  const interaction = interactionMetadata(entries);
  let current = "";
  for (const entry of entries) {
    const rendered = [interaction.get(entry.line), renderEntry(entry)].filter(Boolean).join("\n");
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

async function reviewSession(flags: Record<string, string>) {
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
  const systemPrompt = flags.reviewer
    ? await readFile(resolve(flags.reviewer), "utf8")
    : await readFile(DEFAULT_REVIEWER_PATH, "utf8");
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
    const prompt = `Session: ${session?.id ?? basename(sessionPath)}\nWorking directory: ${session?.cwd ?? "unknown"}\nChunk ${index + 1} of ${renderedChunks.length}\n\nREVIEW SO FAR:\n${reviewSoFar}\n\nNEW SESSION EVIDENCE:\n${renderedChunks[index]}`;
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

async function main() {
  const command = process.argv[2];
  if (command === "--help" || command === "-h") {
    console.log(usageText());
    return;
  }
  if (command === "sessions") {
    const flags = options(process.argv.slice(3), []);
    printSessions(await discoverSessions(flags.since));
    return;
  }
  if (command !== "review") usage();
  const flags = options(process.argv.slice(3));
  await reviewSession(flags);
}

main().catch((error) => {
  console.error(`seshr: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
