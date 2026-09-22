# Add reviewer prompt profiles

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

## Open questions
- Is a profile flag better than separate prompt files?
- Should profiles change Markdown sections or only reviewer emphasis?
- Which profiles are actually useful often enough to maintain?
