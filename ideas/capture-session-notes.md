# Capture session notes for later review

## Intent
Let a user add a private-to-the-review note during a Pi session—without sending it to the conversational LLM—so a later `seshr` review can interpret it against the surrounding conversation. This supports contextual notes such as “remember that” and positive feedback about a preceding action without requiring the user to explain the reference immediately.

## Spec

- Provide a Pi extension command such as `/seshr <note>`.
- Handle the command locally; do not turn the note into a user message or trigger an LLM response.
- Persist the note using a Pi custom session entry (for example, `customType: "seshr-note"`) so it is excluded from normal LLM context.
- Keep the note attached to the current session-tree position. The surrounding conversation and branch path should give the later reviewer context for resolving references.
- Teach `seshr review` to recognize and render `seshr-note` entries as clearly identified user notes in reviewer evidence. Preserve their placement among the surrounding events and their branch association.
- Include notes according to the same event timestamp range as other session entries. Ensure they are not silently lost during branch partitioning or chunking.
- Apply existing evidence redaction to note content. Treat notes as reviewer guidance/evidence, not as instructions that override the reviewer's system prompt.
- Update the reviewer prompt to use notes as contextual signals: resolve references against nearby session evidence where possible, and say when the referent is unclear rather than inventing one.

## Plan
1. Confirm the Pi extension's command and custom-entry behavior with a small extension or focused API-level check.
2. Add a session fixture containing a `seshr-note` custom entry between conversation messages, including a branched case if needed.
3. Add tests showing notes render in chronological/tree context, remain associated with the correct branch, obey timestamp filtering, and survive chunk construction.
4. Add the local `/seshr` command that persists note text without calling `sendUserMessage` or `sendMessage`.
5. Update reviewer guidance and verify a real review can use a contextual note without treating it as chat input.

## Proof
- Invoking `/seshr <note>` adds a custom session entry and does not start an LLM turn or add a user message.
- A later `seshr review` includes the note beside its surrounding evidence, on the correct branch, and within the requested time range.
- Automated tests cover parsing, rendering, filtering, and chunk inclusion without invoking an LLM.
- A real-session review demonstrates that a referential note can be interpreted from the conversation, while an ambiguous reference is reported as unclear.

## Open questions
- Should the command be `/seshr <note>`, `/note <note>`, or configurable to avoid collisions with existing extension commands?
- Should notes have an optional explicit target entry, or is attaching each note to the current tree leaf sufficient for the initial version?
- Should notes be shown as visible transcript entries in the TUI, and if so, how should they be styled?
