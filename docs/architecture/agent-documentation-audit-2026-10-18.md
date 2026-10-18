# Agent documentation audit — 2026-10-18

Scope: read-only comparison of root agent instructions, gameplay/progression contracts, repository entry points and test workflow. This report is **not** a runtime audit; all findings require code confirmation before changing product rules.

## Confirmed documentation inconsistencies

1. **Shard cap:** `docs/GAMEPLAY.md` (Hints and verification) states a maximum of 5 shards, while `docs/PROGRESSION.md` (Shards) says no wallet cap. Verify the current wallet implementation and intended business rule; correct the stale document only after confirmation.
2. **Badge contract:** `docs/AGENT_CONTRACTS.md` still describes four badges including *Sans erreur* and *Maîtrise* requiring three badges, while `docs/PROGRESSION.md` describes three badges (*Autonomie*, *Rapidité*, *Maîtrise*). This is a **high-risk contradiction** for agents fixing badge issues. Verify implementation, migrations and tests before selecting a canonical rule.
3. **Catalogue totals:** `README.md` describes the historical 100 quests / 12 constellations / 150 stars as the current campaign, while `docs/PROGRESSION.md` states 134 / 24 / 298. The latter explicitly labels the former as historical. Derive live counts from the catalogue and refresh the README; do not treat either number as a permanent constant.
4. **Architecture indexing:** `docs/architecture/feature-map.md` says there is no root package manifest, while `package.json` exists and defines `test:affected` and `test:full`. Fix the index after verifying the current default branch.

## Existing strengths — preserve

- `AGENTS.md` already instructs targeted search, bounded file reads, evidence-based diagnosis and relevant test selection.
- Feature/dependency/test maps and debugging guide already exist. Avoid creating competing `BUSINESS_RULES.md` or `ARCHITECTURE.md` documents.
- Cloud persistence and saved progress are blocking invariants. Never relax these contracts for token savings.
- Documentation-only changes require link/path checks, contract review and `git diff --check`. No checks have been run as part of this GitHub-only report.

## Proposed follow-up

1. Verify the four discrepancies against source and tests, especially badge eligibility and shard wallet.
2. Correct the owning documents in the same PR, preserving historical context explicitly.
3. Add a lightweight docs consistency check for stale fixed totals, renamed badges and broken links, with scoped exceptions for historical fixtures.
4. Keep root `AGENTS.md` short and use targeted links; do not require agents to load all product documentation for every task.

No gameplay code or product rule was changed in this audit.
