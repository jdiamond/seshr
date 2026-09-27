# Add date-range and multi-session selection

## Intent
Support reliable recurring reviews of recent session activity while preserving independent, auditable reports. Keep orchestration simple initially; shell scripts can loop over discovered sessions and invoke targeted reviews. Consider native batch orchestration only if that proves cumbersome.

## Spec
Add a time cutoff to targeted review so a caller can review only recent events from a session rather than re-reviewing its full history. Support `yesterday` for daily runs and rolling durations such as `1d`; calendar terms use local dates.

Pi session entries form a tree via `parentId`. Reconstruct that tree instead of treating JSONL file order as one transcript. Include events from all branches that fall within the requested time range, and clearly label branch paths/divergences in the evidence sent to the reviewer so alternate histories are not presented as one linear sequence. Shared ancestry should not be misleadingly duplicated or merged with branch-specific events.

For recurring daily runs, callers can use `seshr sessions` to discover sessions and invoke targeted reviews for each. Review parses session events and selects them by event timestamp. Each report is standalone and records machine-readable metadata including session ID, review time, requested range, and coverage. It should also summarize the matching event count/time span and the counts/time spans of earlier and later events in the session, making clear that this is a partial-session review.

Keep the existing `--output` path handling; do not add an output-path template or prescribe a storage layout. Wrapper scripts own filenames, grouping, and preserving each run as a separate audit artifact. Finding and incorporating previous reviews is deferred, but report metadata should make it possible to locate and relate them later. Mtime-based candidate filtering is an optional optimization to consider later, only if performance warrants it; it must not affect correctness.

Historical review is unfiltered: discover all sessions and invoke the existing targeted review for each complete session. Do not add absolute date-range slicing or bounded historical event scans in this feature. Shell scripts can orchestrate the per-session invocations. Native batch orchestration can be added later if scripting proves cumbersome.

Examples:

```sh
seshr sessions
seshr review --session <path> --since yesterday --output ./review.md
seshr review --session <path> --since yesterday > ./reviews/<chosen-name>.md
```

Sessions should be reviewed independently first. Individual reviews remain available before any separate cross-session synthesis command is added. Project filtering, active-session detection, and `--dry-run` are deferred.

## Plan
1. Inspect representative linear and branched Pi sessions; add small fixtures covering a shared ancestor, alternate branches, and non-monotonic timestamps.
2. Build a session-entry index keyed by entry ID and parent ID. Validate roots, missing parents, duplicate IDs, and cycles; retain file order only as a deterministic tie-breaker, not as conversational order.
3. Reconstruct root-to-leaf paths and identify shared ancestry and branch points. Decide how to represent multiple leaves and malformed/incomplete trees without silently dropping evidence.
4. Define the reviewer rendering: show shared ancestry once, then clearly labeled branch-specific paths; do not imply alternate branches happened sequentially. Ensure branch labels can be traced to source entries.
5. Add event-level `--since` filtering based on entry timestamps. Parse the complete file; include matching events from every branch, and report counts/time spans for included, earlier, later, and missing-timestamp events. Keep selection correct for out-of-order timestamps.
6. Define `yesterday` and rolling-duration parsing, including local timezone behavior; document exact cutoff semantics.
7. Add report coverage/source metadata and a human-readable scope summary, while keeping the existing `--output` contract. Leave artifact naming and storage to wrapper scripts.
8. Test selection, tree rendering, source references, and report metadata with fixtures; manually inspect a real branched session before relying on scripted daily runs.
9. Document shell-based orchestration via session discovery and targeted reviews. Evaluate native batch mode and mtime optimization only after real use or performance evidence.

## Proof
- Daily cutoff parsing and timezone behavior are deterministic and documented.
- Only events since the selected cutoff are sent for review, including matching events on alternate branches.
- Branches are represented clearly; shared ancestry is not duplicated misleadingly and alternate paths are not flattened into a false chronology.
- Event timestamps determine selection even when timestamps are missing or out of order; such cases are handled and reported explicitly.
- Historical all-session review is available through unfiltered discovery and targeted review invocations; bounded historical event slicing is out of scope.
- Reports include source and coverage metadata plus a human-readable summary of included and surrounding events.
- Existing `--output` behavior remains; scripts can preserve distinct audit artifacts without a template feature.

## Open questions
- How should malformed trees, duplicate IDs, missing parents, or multiple leaves be presented?
- What concise branch labels and shared-ancestry representation work best in review evidence?
- Does shell-based orchestration prove cumbersome enough to justify native batch mode?
