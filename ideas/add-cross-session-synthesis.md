# Add cross-session synthesis

## Intent
Identify repeated preferences, workflows, corrections, unresolved questions, and candidate durable changes across individual session reviews.

## Spec
Read completed per-session Markdown reviews and optionally run a meta-review. Preserve links to individual reviews. Keep all suggestions advisory; never edit project files, skills, or instructions automatically.

## Plan
1. Define the per-session artifact location and metadata.
2. Select reviews by date, project, or explicit path.
3. Build a bounded synthesis prompt from those reviews.
4. Generate a report of recurring patterns and evidence links.
5. Add deduplication and confidence guidance to the meta-review prompt.
6. Evaluate against manually known repeated lessons.

## Proof
- Synthesis runs independently of session processing.
- Every meaningful pattern links back to source session reviews.
- Repeated findings are distinguished from one-off suggestions.
- No automatic mutation is performed.

## Open questions
- Should synthesis operate on raw sessions, individual reviews, or both?
- How should conflicting preferences be represented?
- What time window and review count should be the default?
