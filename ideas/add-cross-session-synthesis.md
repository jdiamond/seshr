# Add cross-session synthesis

## Intent
Explore whether individual session reviews contain useful repeated preferences, workflows, corrections, unresolved questions, and candidate durable changes across sessions.

## Spec
Run as a separate command after batch review. Read completed per-session Markdown reviews and optionally run a meta-review. Preserve links to individual reviews. Keep all suggestions advisory; never edit project files, skills, or instructions automatically. Initial use should be exploratory, based on real generated reviews, before committing to a durable synthesis format.

## Plan
1. Generate and inspect a sample of independent session reviews first.
2. Define the per-session artifact location and metadata based on that sample.
3. Select reviews by date or explicit path.
4. Build a bounded synthesis prompt from those reviews.
5. Generate a report of recurring patterns and evidence links.
6. Add deduplication and confidence guidance to the meta-review prompt.
7. Evaluate whether synthesis is useful before expanding the command or output format.

## Proof
- Synthesis runs independently of session processing.
- Every meaningful pattern links back to source session reviews.
- Repeated findings are distinguished from one-off suggestions.
- No automatic mutation is performed.

## Open questions
- Should synthesis operate on raw sessions, individual reviews, or both?
- How should conflicting preferences be represented?
- What time window and review count should be the default?
