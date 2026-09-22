# Add Pi session discovery

## Intent
Let users select Pi sessions by ID or inspect available sessions without manually locating JSONL paths.

## Spec
Add a session-listing command and partial-ID resolution:

```sh
seshr sessions
seshr sessions --since 1d
seshr review --session <partial-id> --output ./review.md
```

Discovery should show IDs, timestamps, working directories, and paths. The initial version does not infer a project filter and does not try to determine whether a session may be resumed later. Active-session detection and an explicit active-session override are deferred.

## Plan
1. Document the supported Pi session directory layout.
2. Discover and parse session headers without reading full sessions.
3. Add `seshr sessions` output, including optional time filtering.
4. Resolve exact and unambiguous partial IDs.
5. Share discovery and filtering logic with batch review.
6. Add fixtures and filesystem-level tests.

## Proof
- Discovery works across the current Pi session layout.
- Ambiguous IDs produce a clear error.
- Targeted explicit paths continue to work.

## Open questions
- How should sessions with missing or malformed headers be displayed?
- Should discovery eventually filter by project directory?
- Should selection use session start time, latest event time, or file modification time?
