# Add date-range and multi-session selection

## Intent
Review more than one eligible session without manually invoking seshr for every file.

## Spec
Support selection by relative age, timestamp range, and all eligible sessions:

```sh
seshr review --since 1d --output ./review.md
seshr review --from <timestamp> --to <timestamp> --output ./review.md
seshr review --all --output ./review.md
```

Sessions should be reviewed independently first. Individual reviews remain available before any aggregate report is generated.

## Plan
1. Build on session discovery.
2. Define timestamp and timezone behavior.
3. Select sessions deterministically.
4. Exclude active sessions by default.
5. Generate per-session artifacts.
6. Decide whether reviews run sequentially or with bounded concurrency.
7. Report individual failures without losing successful reviews.

## Proof
- Time filtering is deterministic and documented.
- Active sessions are excluded unless explicitly targeted.
- Individual failures are visible and do not silently discard other reviews.
- Each session retains its own source metadata.

## Open questions
- Should the output path be a directory for multi-session runs?
- Should this task include aggregate synthesis or keep it separate?
- What concurrency limit is safe for model access and local resources?
