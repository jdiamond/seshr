# Improve CLI packaging and ergonomics

## Intent
Make the MVP convenient to run without adding a CLI framework or unnecessary dependencies.

## Spec
Improve the direct Node/npm experience with:

- clearer argument and error messages;
- `--version`;
- consistent exit codes;
- a reliable executable/bin invocation;
- optional shell completion only if it proves worthwhile.

Remain compatible with Node's built-in TypeScript type stripping and keep the dependency surface empty.

## Plan
1. Add version output from `package.json`.
2. Review invalid-command and invalid-option messages.
3. Verify the executable path through npm and direct invocation.
4. Define exit-code behavior for input, reviewer, and output failures.
5. Add CLI smoke tests.

## Proof
- The documented invocation works from a fresh checkout.
- Invalid commands and options explain how to fix them.
- Exit codes distinguish user errors from reviewer failures where useful.
- No CLI framework or runtime dependency is added.

## Open questions
- Should the executable be called through `npm exec`, a symlink, or both?
- Is shell completion worth maintaining for this small CLI?
- Should configuration move to a file or remain command-line-only?
