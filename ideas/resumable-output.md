# Resume from the final output

## Intent
Allow an interrupted review to continue from the configured Markdown output rather than losing progress or depending on the debug directory.

## Spec
After each successful chunk, seshr writes the current complete Markdown review to the configured output. An invisible metadata comment at the bottom records progress.

Example:

```html
<!-- seshr: {"version":1,"sessionId":"...","sourceHash":"...","chunkChars":100000,"reviewChars":30000,"processedChunks":1,"totalChunks":2} -->
```

Add `--resume`. Resume must verify the session identity, source hash, chunk/review limits, reviewer configuration, and chunk count before continuing. Writes must be atomic through a temporary file and rename.

## Plan
1. Define and parse the metadata format.
2. Factor final Markdown assembly from output writing.
3. Write a checkpoint after every completed chunk.
4. Add `--resume` and validate metadata against the current run.
5. Reject incompatible or stale output rather than resuming unsafely.
6. Test interruption and continuation with a fake reviewer process.

## Proof
- A partial output is readable Markdown after cancellation.
- `--resume` skips completed chunks and continues with the next one.
- Changed source or review configuration is rejected.
- Interrupted writes do not leave a truncated final file.

## Open questions
- Should `--resume` be required, or should existing metadata be resumed automatically?
- Should the final metadata remain in completed reports?
- Should a partial report use a visible status banner as well as the HTML comment?
