# Add date-range and multi-session selection

## Intent
Review more than one eligible session without manually invoking seshr for every file. Generate independent reports first so they can be inspected before any later cross-session synthesis.

## Spec
Support batch review when `--session` is omitted. In batch mode, `--output` is a directory and each session receives its own Markdown report:

```sh
seshr review --output ./reviews
seshr review --since 1d --output ./reviews
```

With no time filter, process all discoverable sessions. `--all` is not needed. Keep the existing targeted form, where `--session` requires a file output path:

```sh
seshr review --session <path> --output ./review.md
```

Sessions should be reviewed independently first. Individual reviews remain available before any separate cross-session synthesis command is added. Project filtering, active-session detection, and `--dry-run` are deferred.

## Plan
1. Build on session discovery.
2. Define timestamp and timezone behavior for the initial time filter.
3. Select sessions deterministically, using all discoverable sessions when no time filter is supplied.
4. Generate per-session artifacts and an index of successes and failures.
5. Keep processing after an individual session fails.
6. Run reviews sequentially initially; consider bounded concurrency after real usage.

## Proof
- Time filtering is deterministic and documented.
- Individual failures are visible and do not silently discard other reviews.
- Each session retains its own source metadata.

## Open questions
- Should reruns skip unchanged sessions, or regenerate every selected report?
- Should selection use session start time, latest event time, or file modification time?
- What concurrency limit is safe for model access and local resources?
