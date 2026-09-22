# Add reviewer prompt profiles

> **Status: Superseded.** Use the existing `--reviewer <file>` option with a complete, user-owned reviewer prompt. Built-in profiles and composed lens flags are intentionally not planned.

## Intent
Support intentional review styles without requiring a custom prompt file for every common use case.

## Spec
Support a small set of explicit profiles, such as:

- `big-picture`;
- `workflow`;
- `preferences`;
- `debugging`.

Keep `--reviewer <file>` for custom prompts. Profiles must not add dependencies or hide the custom prompt path.

## Plan
1. Evaluate whether real-session comparisons show stable, distinct review needs.
2. Define profile-specific output contracts.
3. Store profile prompts as versioned project files.
4. Add profile selection and validation.
5. Evaluate profiles against the same session set.

## Proof
- Profiles are documented.
- Each profile produces a meaningfully different and useful report.
- Custom reviewer files continue to work unchanged.

## Decision

Do not implement this as a separate feature. A user can copy the generic reviewer prompt, customize its sections and review lenses, and select different files for work, home, or separate review runs. This provides more flexibility with less code and no prompt-composition protocol to maintain.

## Open questions
- Should the repository include a generic reviewer prompt example?
- Should the built-in prompt be exposed as a copyable template?
