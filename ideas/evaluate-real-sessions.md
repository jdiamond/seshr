# Evaluate review quality on real sessions

## Intent
Learn whether seshr produces useful reviews before expanding the product surface or tuning defaults based only on one session.

## Spec
Evaluate a representative sample of existing sessions, including coding, research, short, long, failure-heavy, and correction-heavy sessions. Compare chunk/review limits and reviewer prompts using the same model where possible.

Record:

- chunk count;
- runtime;
- output size;
- useful findings;
- repetition;
- factual accuracy;
- missed lessons;
- unsupported suggestions.

## Plan
1. Select and anonymize a small sample of sessions.
2. Run the current default configuration.
3. Run the larger-context configuration.
4. Compare reports manually using a small rubric.
5. Record preferred defaults and prompt changes.

## Proof
- Results exist for several representative sessions.
- A preferred configuration is selected or tradeoffs are documented.
- At least one prompt revision is compared against the same inputs.

## Open questions
- How many sessions are enough for an initial decision?
- Should evaluations be stored in the repository or kept private?
- What matters most: accuracy, usefulness, concision, or recurring-pattern detection?
