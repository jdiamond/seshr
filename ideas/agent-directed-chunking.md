# Agent-directed chunking and detail retrieval

## Intent
Explore whether the reviewer should control its own evidence retrieval instead of receiving all chunks and detail choices from seshr. A reviewer could request tool output, inspect additional details, or ask for the next chunk only when the current evidence indicates it is needed.

This could eventually let the reviewer compact its own working context like a normal Pi session while still producing one bounded final report.

## Spec
Compare two review modes:

### Seshr-directed chunking

The current mode. Seshr deterministically renders and sends bounded chunks in sequence. The reviewer receives the current chunk and draft review, then returns the updated complete review.

```text
seshr chooses evidence → Pi reviews evidence → seshr sends next chunk
```

### Agent-directed chunking

A Pi SDK session or loaded Pi extension provides custom read-only tools such as:

- `get_next_chunk()`;
- `get_tool_output(entry)`;
- `get_entry(entry)`;
- `search_session(query)`;
- `get_session_metadata()`.

The reviewer decides when to request more evidence and which details are worth retrieving.

```text
seshr exposes evidence tools → Pi requests evidence → Pi synthesizes review
```

The agent-directed mode must preserve the existing safety properties:

- no project mutation;
- no session persistence for the reviewer;
- no arbitrary tools beyond the explicit read-only evidence tools;
- deterministic source access and redaction;
- bounded total evidence, tool calls, and model context;
- a complete Markdown result with source references.

The Pi SDK may provide custom tools directly. A Pi extension loaded through an explicit CLI option may provide a way to prototype the same behavior without adopting the SDK immediately. The extension approach and SDK approach need to be verified rather than assumed equivalent.

## Plan
1. Document the current seshr-directed behavior as the baseline.
2. Inspect the Pi SDK and extension APIs for read-only custom tools and ephemeral sessions.
3. Build a toy reviewer tool that can request the next rendered chunk.
4. Add a second tool for retrieving selected redacted tool output or entry details.
5. Compare agent-directed and seshr-directed reviews on the same sessions.
6. Add limits for evidence requests, tool calls, total retrieved characters, and elapsed time.
7. Measure whether agent-directed retrieval improves quality enough to justify SDK or extension complexity.

## Proof
- The reviewer can request the next chunk without seshr pre-sending it.
- Requested tool output remains redacted, bounded, and read-only.
- The reviewer cannot read project files, create a session, or invoke arbitrary tools.
- The reviewer can compact earlier evidence while retaining source references.
- Agent-directed mode produces a final review at least as useful as seshr-directed mode for representative sessions.
- Runtime, model calls, retrieved evidence, and failure behavior are observable.

## Open questions
- Can a Pi extension expose custom tools in the exact non-interactive invocation needed here?
- Does the Pi SDK support an ephemeral reviewer session with custom tools and no inherited context?
- Can the reviewer request a next chunk while still receiving a final response cleanly?
- How would a reviewer signal that it is finished rather than requesting more evidence?
- Should the reviewer be allowed to retrieve successful tool output, or only selected entries and summaries?
- What prevents an agent-directed reviewer from repeatedly requesting evidence until it exhausts the budget?
- Is “agent-directed chunking” clearer than “internal chunking” versus “external chunking”?
- Should this remain an experimental backend rather than complicating the default MVP path?
