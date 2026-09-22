# Add regression tests

## Intent
Make the parser, renderer, chunker, redaction, and CLI behavior safe to change without reintroducing bugs already found during MVP experiments.

## Spec
Use Node's built-in test runner with no test dependencies. Cover:

- Pi JSONL parsing;
- user and assistant text extraction;
- compact tool-call summaries;
- omission of successful `toolResult` output;
- retention of failed tool output;
- credential redaction;
- deterministic chunking;
- argument validation;
- debug checkpoint naming.

Tests must use fixtures and must not invoke a real model or require credentials.

## Plan
1. Extract testable parsing/rendering functions if necessary.
2. Add representative JSONL fixtures for message, tool-call, successful-result, and failed-result events.
3. Add focused unit tests with `node --test`.
4. Add a package script for the test command.

## Proof
- `node --test` passes.
- Both `tool` and `toolResult` event shapes are covered.
- A regression test fails if successful tool output is sent to the reviewer.

## Open questions
- Should fixtures live under `test/fixtures/` or beside the tests?
- Should CLI argument parsing be tested through subprocesses or through exported functions?
