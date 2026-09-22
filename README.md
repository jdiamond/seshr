# seshr

**Session reviewer for coding-agent work.**

> Review the work. Keep the lessons.

`seshr` is a standalone CLI that reviews coding-agent session files and produces Markdown reports about what happened, what may be worth remembering, and what should be considered for future workflow improvements.

It runs outside the harness. It starts with Pi session JSONL, uses Pi for bounded review, and leaves any application of suggestions to a human or a separate agent. Other harnesses may be supported later, but they are not part of the initial scope.

## Vision

Coding-agent sessions contain a lot of useful information that normally disappears:

- preferences and corrections that get repeated across sessions;
- project conventions that never make it into `AGENTS.md`;
- recurring workflows that should become skills, prompt templates, or scripts;
- decisions and rejected approaches;
- tickets and pull requests worked on;
- PRs created, reviewed, or commented on;
- logs and searches investigated;
- questions asked and unresolved follow-up work;
- commands, tests, failures, and verification steps.

`seshr` periodically reviews this activity and produces a factual activity report plus proposed durable changes. The human reviews and applies those changes.

The central loop is:

```text
session files
    |
    v
 deterministic reader + chunker
    |
    v
 isolated Pi review loop
    |
    v
 Markdown session reviews
    |
    v
 optional cross-session synthesis
```

## What seshr is not

- Not another agent runtime or chat interface.
- Not a replacement for Pi, Claude Code, OpenCode, or other harnesses.
- Not a background process embedded inside every agent session.
- Not an autonomous writer of instructions that silently changes future behavior.
- Not dependent on Herdr, though it can coexist with any terminal multiplexer.

## Review output

The output is plain Markdown written to a configured location. It may be placed in an Obsidian vault, a project directory, or a private review archive, but `seshr` does not need to know which one.

A report may suggest changes to:

- `AGENTS.md` or equivalent instruction files;
- [Agent Skills](https://agentskills.io/) in `SKILL.md` format;
- project-local scripts;
- prompt templates, where a harness-specific format is needed.

These are review targets, not files that `seshr` edits. `seshr` itself should not modify `AGENTS.md`, create skills, change scripts, or manage an Obsidian vault.

## Review pipeline

`seshr` does not build a second, harness-neutral copy of every session event. The original session files remain the source of truth. A small harness adapter only knows how to discover sessions, read entries, and identify evidence locations.

For the first implementation, the adapter supports Pi JSONL sessions.

```text
Pi JSONL
  |
  v
turn extraction + deterministic rendering
  |
  v
Pi: review bounded chunks and update the draft review
  |
  v
one Markdown review per session
  |
  v
optional meta-review across session reviews
```

The review loop is bounded explicitly:

```text
system prompt + session chunk + review-so-far + output reserve
  < configured context budget
```

The reviewer returns the complete current Markdown review after incorporating each chunk, rather than appending indefinitely. Chunks are processed sequentially within a session. Multi-session processing is deferred.

### Current artifacts

The targeted MVP writes to the path supplied with `--output`. With `--debug-dir`, it also saves the system prompt and each intermediate prompt/review pair:

```text
<debug-dir>/system-prompt.md
<debug-dir>/chunk-NNN.prompt.md
<debug-dir>/chunk-NNN.review.md
```

Each report retains the source session path, session ID, working directory, and evidence references. Per-session storage conventions and cross-session synthesis are future work.

## Activity, lessons, and suggestions

A report should preserve both sides of the review:

- **Activity:** what the session directly shows—its purpose, meaningful work, decisions, tests, failures, and unresolved work.
- **Lessons:** information worth carrying beyond the session—preferences, corrections, workflow patterns, project conventions, or durable context. A focused session may have no lessons.
- **Suggestions:** reviewer interpretations of what might be worth changing in `AGENTS.md`, a skill, prompt, script, test, or workflow.

These categories should remain distinct. Activity and lessons retain source session and entry references; suggestions are proposals, not changes. The user can ask an agent to inspect the report and apply selected ones.

For the MVP, `seshr` reports from session evidence and does not verify or enrich GitHub, ticket-system, or Git history facts. Those integrations can be added later without changing the review format.

The main output is Markdown. The targeted single-session run is the current development and testing path; time-range selection, session discovery, and cross-session synthesis remain future work.

### Current MVP

The initial implementation supports the targeted path without external dependencies:

```sh
node src/cli.ts review \\
  --session ~/.pi/agent/sessions/<project>/<session>.jsonl \\
  --output ./review.md \\
  --chunk-chars 100000 \\
  --review-chars 30000 \\
  --model opencode-go/gpt-5.6-luna \\
  --debug-dir /tmp/seshr-debug \\
  --verbose
```

`--chunk-chars` and `--review-chars` are runtime tuning knobs: larger values can reduce the number of agent calls and improve cross-session coherence, while increasing prompt size, latency per call, and potentially input-token cost. The defaults are 24,000 and 12,000 characters; the larger values above are useful for models with large context windows. `--verbose` logs the selected model, event and byte counts, per-agent timing, review sizes, and total duration. `--debug-dir` is separate debugging/recovery support: it saves the system prompt plus each prompt/review pair as `chunk-NNN.prompt.md` and `chunk-NNN.review.md`, preserving intermediate results if a run is cancelled.

The default reviewer prompt is the editable `prompts/default-reviewer.md` template. Copy it to personalize the report for a different context, then pass it with `--reviewer <file>`; the custom file replaces the default prompt. The template is organized around report sections so users can adjust emphasis without changing the CLI. The source session and project files are never modified.

## Current scope

The MVP currently supports one explicitly targeted Pi JSONL session. It deterministically renders user and assistant text, compact tool-call summaries, and important failures; omits routine successful tool output; redacts common credentials; and invokes isolated Pi processes with no session persistence, tools, extensions, skills, or context files.

Each chunk updates a complete draft review. The reviewer is instructed to synthesize the big picture rather than produce an audit or file-by-file transcript. The source session and project files remain untouched. The first acceptance test is to run seshr against an existing session, inspect the Markdown, run it again, and verify that only the configured output changes (plus any explicitly requested debug artifacts).

Deferred until the targeted path proves useful:

- resumable output;
- session discovery and active-session filtering;
- time-range and all-session selection;
- parallel reviews;
- cross-session synthesis;
- scheduling;
- other harnesses;
- automatic application of suggestions;
- GitHub, ticket, and deployment enrichment.

## Work items

The `ideas/` directory is the lightweight backlog. Each idea keeps its `Intent`, `Spec`, `Plan`, `Proof`, and `Open questions` sections in one Markdown file. When an idea is accepted for implementation, those sections become the change record rather than separate planning files.

## Design principles

- **External CLI first.** Do not require a harness extension or resident daemon.
- **Local-first.** Keep raw session data and review artifacts local by default.
- **No duplicate ledger yet.** Read source session files directly; retain only useful review artifacts.
- **Evidence before inference.** Every meaningful suggestion should be traceable to a session entry.
- **Bound every prompt.** System prompt, chunk, review-so-far, and output reserve must fit the configured context budget.
- **Proposal before mutation.** Durable instructions and skills require review by the user or an agent.
- **Portable formats.** Prefer Markdown and Agent Skills; add harness-specific prompt adapters later.
- **Do not process active sessions.** Avoid reading files while they are being written, except for explicit targeted testing.
- **Avoid secrets.** Redact credentials and sensitive tool output before sending anything to Pi.
- **One useful thing before a platform.** Start with Pi sessions and Markdown output; add classifiers, enrichment, and other harnesses only after the review loop works.

## Working definition of success

After using `seshr` for a few weeks:

- repeated explanations should decrease;
- useful project conventions should become explicit;
- recurring workflows should become skills or scripts;
- review output should be available at a configured location without manual transcription;
- proposed changes should be understandable and evidence-backed;
- nothing important should change without the user's approval.
