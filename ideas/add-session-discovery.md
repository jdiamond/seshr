# Add Pi session discovery

## Intent
Let users select Pi sessions by ID or inspect available sessions without manually locating JSONL paths.

## Spec
Add a session-listing command and partial-ID resolution:

```sh
seshr sessions
seshr review --session <partial-id> --output ./review.md
```

Discovery should show IDs, timestamps, working directories, and paths. Actively written sessions are excluded by default, with an explicit targeted-session override for testing.

## Plan
1. Document the supported Pi session directory layout.
2. Discover and parse session headers without reading full sessions.
3. Add `seshr sessions` output.
4. Resolve exact and unambiguous partial IDs.
5. Detect active sessions conservatively.
6. Add fixtures and filesystem-level tests.

## Proof
- Discovery works across the current Pi session layout.
- Active sessions are not processed accidentally.
- Ambiguous IDs produce a clear error.
- Targeted explicit paths continue to work.

## Open questions
- How should sessions with missing or malformed headers be displayed?
- What counts as active: recent modification time, lock file, or both?
- Should discovery filter by project directory?
