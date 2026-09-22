# Improve source references

## Intent
Make report evidence easy to trace back to the original Pi session without making the big-picture report noisy.

## Spec
Decide whether `[entry N]` should mean a physical JSONL line, a Pi event ID, or both. Prefer a compact format that lets a reader locate the evidence unambiguously.

Possible format:

```text
[line 230, id abc123]
```

## Plan
1. Compare physical line numbers and Pi event IDs across session edits.
2. Decide which identifier is stable and useful for follow-up.
3. Update deterministic rendering and reviewer instructions together.
4. Update the report metadata and tests if the format changes.

## Proof
- The reference format is documented.
- A cited observation can be located in the source session without guesswork.
- References remain correct after resume and rerun.

## Open questions
- Is the physical line number sufficient for a local-first tool?
- Should the report include a source-navigation command?
- Should ranges such as `[entries 231–238]` be allowed?
