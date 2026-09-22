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
Pi: review bounded chunks and rewrite review-so-far
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

The reviewer rewrites the complete `review-so-far` rather than appending indefinitely. Chunks are processed sequentially within a session; separate sessions may be reviewed in parallel with a configurable limit.

### Session review artifacts

Keep the final review for each processed session. These are useful for testing, rerunning, and later cross-session synthesis; intermediate chunk results can remain ephemeral.

```text
~/.seshr/reviews/pi/<session-id>.md
~/.seshr/runs/<timestamp>.md
```

Each review should retain source metadata and evidence references. The final run report can link to the individual reviews and identify common patterns.

## Observed facts and suggestions

A report should separate what the session directly shows from what the reviewer infers.

### Observed

These are directly represented in the source session:

- a user question or correction;
- a command that ran;
- a file that was read or edited;
- a test result or error;
- an assistant decision or explanation.

Observed items should retain a source session and entry reference.

### Suggested

These are reviewer interpretations that need human judgment:

- the same preference may be worth adding to `AGENTS.md`;
- a repeated procedure may be worth turning into a skill;
- a command sequence may deserve a script;
- an instruction may be stale or contradictory.

Suggestions are not changes. The user can ask an agent to inspect the Markdown report and apply selected ones.

For the MVP, `seshr` reports from session evidence and does not verify or enrich GitHub, ticket-system, or Git history facts. Those integrations can be added later without changing the review format.

## Proposed CLI shape

```text
seshr review --session <id-or-path> --output <path>
seshr review --since 1d --output <path>
seshr review --from <timestamp> --to <timestamp> --output <path>
seshr review --all --output <path>
```

The main output is Markdown. A targeted session run is the primary development and testing path. A time-range run reviews individual sessions, then optionally synthesizes those reviews into one report.

The initial reviewer backend should invoke Pi as an isolated non-interactive process with no session persistence, tools, extensions, skills, or context files. A TypeScript implementation may use Pi's SDK later if process startup becomes a measured problem, but the first version should prefer process isolation and a small dependency surface.

## Initial scope

Start Pi-first without making the design Pi-specific:

1. Discover Pi JSONL sessions by ID, time range, or all.
2. Exclude actively-written sessions unless explicitly targeted for testing.
3. Extract conversation turns and render bounded chunks deterministically.
4. Omit noisy tool output by default while retaining commands, paths, exit codes, and important errors.
5. Invoke isolated Pi reviewer processes with a bounded review-so-far.
6. Save one Markdown review per session.
7. Optionally run a meta-review over those Markdown reviews.
8. Write the final Markdown report to a configured output location.

Do not build a normalized event ledger, classifier pipeline, automatic mutation pipeline, GitHub/ticket enrichment layer, Obsidian integration, or multi-harness adapter framework until the basic session-review loop proves useful. Other classifiers and harness adapters may be added later.

## MVP plan

Start with one targeted Pi session:

```text
seshr review --session <path> --output <path>
```

The MVP will:

1. Read one Pi JSONL session.
2. Render conversation turns into bounded chunks deterministically.
3. Omit noisy tool output by default while retaining commands, paths, exit codes, and important errors.
4. Invoke Pi as an isolated reviewer with `--no-session`, `--no-tools`, `--no-extensions`, `--no-skills`, and `--no-context-files`.
5. Pass each chunk plus a bounded `review-so-far` to the reviewer.
6. Ask the reviewer to rewrite the complete Markdown review rather than append indefinitely.
7. Write one review to the configured output path.
8. Leave source sessions and project files untouched.

The first acceptance test is to run `seshr` against an existing session, inspect the Markdown, run it again, and verify that it creates no Pi session and modifies nothing except the configured output.

Defer until the single-session path is useful:

- time-range and all-session selection;
- parallel reviews;
- cross-session meta-review;
- scheduling;
- Obsidian-specific behavior;
- other harnesses;
- classifiers;
- GitHub and ticket enrichment;
- automatic application of suggestions.

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
