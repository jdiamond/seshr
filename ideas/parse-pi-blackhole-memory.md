# Parse pi-blackhole memory additions

## Intent
Use observations and reflections added to Pi sessions by [pi-blackhole](https://github.com/k0valik/pi-blackhole) as additional evidence in `seshr` reviews when discovered. These memory additions can preserve durable decisions, preferences, and facts that are otherwise easy to miss in a transcript review.

## Spec
Detect pi-blackhole's observational-memory additions in session data and parse them into reviewable evidence, while continuing to treat the original Pi session as the source of truth. Support the `## Reflections` and `## Observations` sections and their entry IDs when the storage format is understood. Do not assume the README's rendered example is the on-disk representation.

When no pi-blackhole data is present, review behavior should remain unchanged. Malformed or unknown formats should be ignored or surfaced as non-fatal diagnostics rather than breaking session review.

## Investigation
Learn and document how pi-blackhole persists memory additions:
- Identify whether additions appear as ordinary session messages, extension/custom entries, or in separate ledger/pending files.
- Determine how those records associate with a session and how compaction affects them.
- Inspect real session and ledger fixtures, including manual mode if applicable.
- Establish stable fields/markers and parsing rules; avoid relying on incidental presentation text.
- Trace IDs back to source entries where possible so parsed memory retains evidence references.

## Plan
1. Inspect pi-blackhole source and documentation for ledger, pending-buffer, and session-injection serialization.
2. Confirm the storage format against representative session and sidecar fixtures.
3. Specify detection, extraction, provenance, and malformed-data behavior.
4. Add an optional parser and fixtures/tests for supported formats.
5. Include discovered observations/reflections as clearly attributed evidence in session reviews.

## Proof
- Ordinary Pi sessions without pi-blackhole data are unaffected.
- Supported memory additions are parsed with their type, content, ID, and source association where available.
- Unknown or malformed records do not fail a review.
- Tests cover the verified on-disk format, not only the README rendering.
