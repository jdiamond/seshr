# Improve session rendering

## Intent
Improve evidence quality without sending routine successful tool output or full file contents to the reviewer.

## Spec
Retain compact metadata for high-signal activity:

- read, write, and edit paths;
- exit codes and command status;
- test/build summaries;
- command durations when available;
- failed commands and important errors.

Continue omitting large successful output and full file contents by default.

## Plan
1. Inventory Pi tool-call and tool-result shapes from real fixtures.
2. Add compact summaries for high-value tools and result metadata.
3. Keep routine successful output omitted.
4. Add fixtures and tests for each rendering rule.
5. Compare report quality before and after the change.

## Proof
- High-signal tool metadata is retained deterministically.
- Routine successful output remains omitted.
- Rendering behavior is covered by tests.
- A real-session comparison shows whether the added metadata improves review quality.

## Open questions
- Should tool output have `none`, `important`, and `all` modes later?
- Which tools deserve special handling beyond `bash`, `read`, `write`, and `edit`?
- How should large error output be truncated while retaining the useful part?
