# Grid catalogue, generation and audit

## Current state
Production does **not generate campaign grids on demand**. The campaign uses a pre-generated catalogue embedded as `CAT` in `index.html`, with a fixed `CAMPAIGN_SIZE_SCHEDULE` and a curated order for 6x6 puzzles.

The 100-quest schedule mixes 4x4/5x5 onboarding grids with 6x6, 7x7 and 8x8 puzzles. Do not replace this with runtime random generation without an explicit product decision.

## Required puzzle representation
Each puzzle stores:
- `reg`: N x N territory identifiers;
- `sol`: one solution column per row.

## Hard structural validity
Every catalogue entry must satisfy:
1. square N x N region matrix;
2. exactly one stored Guardian per row by representation;
3. all solution columns unique;
4. all solution territories unique;
5. consecutive solution rows may not have columns within distance 1 (no touching diagonally/vertically);
6. every territory used by the puzzle is coherent with the one-per-territory rule;
7. no single-cell territory (current regression invariant).

## Uniqueness
The code comments describe campaign grids as having a **single audited solution**. Any future generator/audit must explicitly enumerate/count valid Guardian arrangements and require exactly one solution. Merely validating the stored `sol` is insufficient.

## Explainability / difficulty
A mathematically valid unique puzzle is still not campaign-ready. Starting from an empty board, the explainable `proofEngine()` must be able to replay it to completion without becoming stuck and without opaque search.

Accepted proof families in the current replay audit include structured single placements and eliminations such as `locked`, `group`, `diamond` and `manual`. Placement hints must not silently fall back to exhaustive `solutions()` or contradiction search inside `proofEngine()`.

Difficulty should come from the logical deductions required, board size and assistance restrictions—not from ambiguity or guessing. If adding generated puzzles, compute and store audit metadata (solution count, proof steps, rule mix, hardest rule, board size) so campaign ordering can be reviewed deterministically.

## Generator specification for future tooling
A safe offline generator should:
1. generate/choose a legal Guardian solution;
2. construct connected territories around it, with exactly one solution Guardian per territory;
3. reject malformed/single-cell territories;
4. enumerate all legal solutions and reject unless count == 1;
5. replay with `proofEngine`-equivalent logic and reject if stuck/opaque;
6. score difficulty from explainable proof trace;
7. deduplicate grids under relevant symmetries/identical region layouts;
8. output immutable JSON suitable for `CAT`;
9. run the full catalogue audit before insertion.

Generation belongs in an offline/dev script, not the player's runtime path.

## Mandatory catalogue audit
After any change touching `CAT`, solver/proof rules, board semantics or campaign schedule, audit **all campaign grids**, not only the currently displayed size. Check validity, unique solution, explainable replay, campaign count=100, constellation mapping and absence of duplicate/broken schedule references.
