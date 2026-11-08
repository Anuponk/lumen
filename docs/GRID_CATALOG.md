# Grid catalogue, generation and audit

When an explicitly authorized player reset accompanies regenerated grids, its
quest scope comes from the replacement manifest, never ordinal ranges at runtime.
Grid revision and player reset epoch are independent: changing acquired records
on the same grid also invalidates that player's active attempt. Exact prior board
bytes are archived before replacement; quota or archive conflicts block it. Other
players and untouched grids keep their normal progression and active attempts.

## Logical difficulty and explicit grid revisions (#640)

`src/game/logical-difficulty.js` rates a territory matrix without reading its
stored solution. It always takes available singles before more complex rules.
It propagates exact-one rows, columns and territories, guardian conflicts,
house intersections, common non-touching consequences and Hall pairs/triples
between disjoint exact-one partitions. Sudoku digit techniques are not imported.
There is no speculative placement, contradiction branch or backtracking in this
model. Stalling rejects the candidate. Mathematical uniqueness is a separate
enumeration; the existing UI `proofEngine` must independently finish every grid.

Each deduction records targets, rule, candidate houses, prior elimination fact
IDs, dependency depth and remaining global candidates. Guardian propagation is
recorded separately with its placement as prerequisite. One fact may eliminate
several cells with identical premises. Depth is one plus the maximum premise
depth, not the trace index. Candidate scans have a fixed row/column/region and
row-major tie order; this is one reproducible solving policy, not the minimum
over every possible human solving path. Rule complexity and dependency structure
follow [PelÃ¡nek's overview and evaluation](https://arxiv.org/abs/1403.7373)
and [computational model](https://www.fi.muni.cz/~xpelanek/publications/flairs-sudoku.pdf).
Generate-and-test with independent uniqueness and inference checks follows
[Hunt, Pong and Tucker](https://aaaipress.org/Library/AAAI/2007/aaai07-361.php).

The v1 score is `10 * effort / N + 2 * maximumPlacementDepth +
4 * deductionsBeforeFirstPlacement + 8 * advancedDeductions / N`.
Effort weights: single 1, guardian propagation 0, intersection 2, common
adjacency 3, Hall pair 4, Hall triple 6. Advanced deductions are adjacency,
pairs and triples. Dimension has no additive reward. Initial singletons,
shallow placements (depth <= 3), first-placement depth, intermediate deductions,
rule diversity and total effort are reported separately. Forced branches are
explicitly zero. These are logical model estimates, **not human-calibrated times**.

`node scripts/regenerate-logical-grids.mjs` performs seeded boundary mutation
and connected growth offline. It rejects disconnected/singleton territories,
multiple solutions, stalled models, stalled UI proofs, shallow openings and D4
duplicates against the original catalogue. Selection also requires at least six
different cells between normalized D4 signatures, avoiding near-identical
boundary variants. All selected grids are 8Ã—8: the increased difficulty in
Adventures 5â€“8 is not obtained by making the later boards larger. Scores form
strictly separated Adventure bands and ascend within each constellation. Band
labels are content assignments (IntermÃ©diaire, AvancÃ©, Expert, MaÃ®tre), checked
against the measured distribution rather than claimed as player calibration.

`content/generated/logical-grids-v1.json` is the explicit, scoped replacement
manifest for Adventures 5â€“8. It records old/new SHA-256 grid hashes, unchanged
quest membership, seed/search statistics and independently reproducible ratings.
Original source manifests and access-origin hashes remain immutable;
`originalCanonicalQuestList()` is audit/rollback tooling, while gameplay uses
`canonicalQuestList()`. This is the owner-authorized exception to the general
unchanged-grid rule; future unlisted replacements still fail the audit. Astronomy,
quest IDs, order, rewards and rights do not change. Adventure 9 is unchanged.
Historical social links keep the original grid; new challenges carry revision 1
through the additive prepared RPC. Both versions remain independently auditable.

Run `node scripts/logical-grid-tests.mjs` to independently verify all replacements
and the committed [distribution](validation/logical-difficulty-640.json), then
the full quality gate and strict catalogue audit. `--write` recomputes the report;
it does not publish content. Review all source changes together in one PR. Do not
merge while production deployment is forbidden: the main quality workflow can
trigger the production publisher. Human timing/physical-device QA remains a
distinct acceptance step; touch-handler proof replays are automated evidence.

## Current state
Production does **not generate campaign grids on demand**. The canonical campaign combines the legacy pre-generated `CAT`/numeric schedule with audited committed JSON manifests through `canonical-quests.js`. Published catalogue revision 4 contains 880 quests across 88 constellations and nine Adventures. See [the full catalogue](CATALOGUE_88.md) and [the 380-grid replay report](validation/iau-completion.md).

The schedule starts with two 5x5 onboarding grids. Later Adventures use audited grids up to 10x10. Campaign length derives from the content model; the original 100 assignments and the entire previously published 500-quest prefix remain protected by frozen compatibility comparisons. Do not replace this with runtime random generation without an explicit product decision.

All future development must follow the [evolving catalogue contract](DATA_AND_ARCHITECTURE.md#evolving-catalogue-contract): catalogue totals are data, existing player identities are stable, and every addition must be checked across navigation, rewards, restoration and dependent product surfaces. Adding an audited unused grid does not automatically schedule it or grant access to it.

The issue-222 PR generator produces an audited downloadable artifact with
read-only repository permission; it must not commit or push generated content
onto the PR branch. Despite its historical `staged-only` label, the committed
`content/generated/issue-222-additions.json` contributes to the canonical
registry. Replacing its plan can reorder published identities and violate the
immutable catalogue revision. Review any promotion separately against access
origins and stable quest keys; a passing generation audit is not that review.

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
7. no single-cell territory outside the two explicitly scripted onboarding entries. The approved exceptions are `CAT["5"][0]`, territory 2 at row/column 2 (the central first Guardian), and `CAT["5"][1]`, territory 0 at row/column 0. Indices are zero-based. No other singleton territory is permitted.

These two exceptions implement the explicit product request to introduce a forced first Guardian. They do not relax structural validity, connectivity, uniqueness or explainable replay. The former unused 4x4 onboarding entry has been removed.

## Uniqueness
The code comments describe campaign grids as having a **single audited solution**. Any future generator/audit must explicitly enumerate/count valid Guardian arrangements and require exactly one solution. Merely validating the stored `sol` is insufficient.

## Explainability / difficulty
A mathematically valid unique puzzle is still not campaign-ready. Starting from an empty board, the explainable `proofEngine()` must be able to replay it to completion without becoming stuck and without opaque search.

Accepted proof families in the current replay audit include structured single placements and eliminations such as `locked`, `group`, `diamond` and `manual`. Placement hints must not silently fall back to exhaustive `solutions()` or contradiction search inside `proofEngine()`.

Difficulty should come from the logical deductions required, board size and assistance restrictionsâ€”not from ambiguity or guessing. If adding generated puzzles, compute and store audit metadata (solution count, proof steps, rule mix, hardest rule, board size) so campaign ordering can be reviewed deterministically.

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

The two onboarding grids were audited with one solution each. With the current proof engine, the central grid replays in 22 structured steps (17 group eliminations, 5 singles); the second replays in 11 (6 group eliminations, 5 singles). Their scripted placement order must also consist of forced territory placements rather than guesses.

## Mandatory catalogue audit

The canonical schedule reads the current published catalogue revision, validated
by `quest-definition.js`, instead of synthesizing fixed-size slots.
`catalogue-compatibility-tests.mjs` still checks every published hash/reference
against its immutable revision. This identity check and the separate `CAT`
audit do not replace uniqueness/explainable replay of generated manifests.
After any change touching `CAT`, solver/proof rules, board semantics or campaign schedule, audit **all campaign grids**, not only the currently displayed size. Check validity, unique solution, explainable replay, campaign count matching the content model, contiguous constellation mapping and absence of duplicate/broken schedule references. Audit quest rewards against each constellation's actual stars and their sum against the derived sky target. Adding content must not require replacing fixed totals in these assertions.

Run `node scripts/audit-catalogue.mjs` for a reproducible offline audit using the application's actual catalogue and proof engine. It checks all catalogue entries and campaign references and exits nonzero on failure. Known failures must remain visible; do not treat them as an allowlist or a passing release gate.

## Offline replacement tooling â€” 2026-10-03

`node scripts/replace-blocked-grids.mjs` generates replacements for entries in the 7x7 and 8x8 catalogues that the actual proof engine cannot finish. Add `--write` to insert them at their existing catalogue indices in `src/campaign/catalogue.js` and immediately audit the entire catalogue; an audit failure restores the original catalogue file. A catalogue with no blocked entries is left untouched.

The generator uses seed `20261003`, legal non-touching Guardian permutations and connected territory growth. It rejects singletons, multiple solutions and stalled/incorrect proof steps. Accepted layouts are deduplicated against the existing catalogue and each other under all eight square symmetries, independently of territory labels. It stores board size, solution count, proof steps, rule mix and hardest rule. Board size plus proof length/rules provide deterministic difficulty information; existing campaign sizes and indices are retained rather than silently reordering quests.

The 22 replacements (11 per size) were selected from 1,970 candidates. The 7x7 replacements need 45â€“48 structured proof steps; the 8x8 replacements need 61â€“64. `scripts/generated/replacements-2026-10-03.json` records the exact accepted grids, audits and hashes of the replaced data. Generation is offline only, and neither the proof engine nor player persistence changed. All 134 catalogue entries now pass the strict audit.

## Pedagogical topology validation (#57)

The opening catalogue data is unchanged. Its existing center singleton and connected territories already produce the requested lesson: forced placements (2,2), (4,3), (3,0), (0,1), (1,4), after real row/column/adjacency/territory eliminations. `scripts/learning-tests.mjs` verifies each placement has exactly one remaining candidate in its territory, and the full catalogue audit still checks mathematical uniqueness and explainable proof replay. The second Guardian reserves adjacent cells (4,0) and (4,1) to introduce the real drag gesture.

## Diverse offline candidates (#340)

`node scripts/generate-diverse-grids.mjs --size 8 --family serpentine --count 5 --seed 340 --attempts 10000 --out /tmp/lumen-candidates.json` proposes **new** candidates without touching `CAT` or saved progress. Supported experimental profiles: `classic`, `serpentine`, `mosaic`, `balanced`, `hybrid`. Use `--minimum-score` to filter by explainable proof score. The output contains reproducible source seed, unique puzzles, proof-derived metadata, geometry metrics and a shortfall field. Nonzero exit on shortfall. These are **candidates, not automatically published quests**; reviewers must still visually inspect them and schedule them through the catalogue contract. Scores are heuristics, not calibrated human difficulty or measured chain depth. Avoid making a claim about Expert difficulty from score alone.

Run `node scripts/generate-diverse-grids-tests.mjs` as a dedicated check and then the full quality gate before integrating content. Generated JSON never overwrites campaign grids. A later enhancement should model dependency chains, catalogue-level similarity and empirical player calibration.
## Aventure 5 â€” candidat de publication (#598 / #599)

Â« Les chemins du firmament Â» ajoute 100 quÃªtes canoniques, numÃ©rotÃ©es 401â€“500,
dans dix constellations rÃ©elles. Les identitÃ©s, positions, grilles et clÃ©s de
sauvegarde des 400 quÃªtes prÃ©cÃ©dentes restent exactes. La rÃ©vision 3 est ajoutÃ©e
Ã  lâ€™historique immuable ; aucune ancienne rÃ©vision ni origine de joueur nâ€™est
rÃ©Ã©crite. Les nouveaux IDs sont `pack-real-adventure-05-q001` Ã  `q100`.

Le gÃ©nÃ©rateur conserve le mÃªme pool de 100 grilles inÃ©dites et ordonne le
candidat non publiÃ© par taille puis score de preuve croissants. Chaque
constellation passe de cinq 7Ã—7 Ã  cinq 8Ã—8. Le score reste une heuristique,
pas une difficultÃ© humaine acceptÃ©e. Le validateur rejoue proofEngine,
lâ€™unicitÃ©, la connexitÃ©, lâ€™absence de singleton et les signatures D4 contre les
autres aventures. Aucun point ou segment astronomique nâ€™est inventÃ© : les dix
figures utilisent lâ€™atlas Western/Hipparcos dÃ©jÃ  auditÃ© et attribuÃ©.

La migration candidate `20261104191554_adventure_05_catalogue.sql` ajoute les
100 contrats/allowlists et la prise en charge dâ€™origine 3, sans backfill de
profils, droits, badges ou monnaie. Sa prÃ©paration nâ€™autorise pas son activation.
La publication exige CI, recette, dÃ©cision serveur distincte et read-back du
dÃ©ploiement ; ne pas annoncer lâ€™aventure disponible sur la seule gÃ©nÃ©ration.

