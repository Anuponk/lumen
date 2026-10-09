# First adventure: generation and audit

The proposed adventure has 10 unused IAU constellations and 10 puzzles each.

```bash
node scripts/generate-pack.mjs --dry-run --config content/first-adventure-preview.json
node scripts/export-first-adventure.mjs
```

The second command invokes the audited generator with seed 42 and **only** writes `artifacts/first-adventure-generated.json` when all 100 puzzles exist and pass the staging and uniqueness checks. It exits unsuccessfully and writes nothing if the generator cannot satisfy these conditions. The resulting manifest is a **local review artifact**, not a published pack.

Review the generated difficulty curve, inspect puzzle validity and performance, then implement and test a separate append-only publication step before exposing the pack to players. Existing quest indices and saves must not be changed. This script is not proof that 100 puzzles have already been generated: it must be executed and its output reviewed.
