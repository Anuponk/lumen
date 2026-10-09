# Constellation gallery preview

Generate the **read-only** 88-constellation gallery locally:

```bash
node scripts/export-constellation-preview.mjs
```

Open `artifacts/constellation-preview.html` in a browser.

The export contains the 24 legacy constellations and 64 imported silhouettes. It does **not** add quests, change published content, or modify player progress. The generated HTML is a local review artifact, not a public application route.

The imported geometry comes from d3-celestial. Review `docs/constellation-artwork-attribution.md` and verify any additional upstream dataset rights before distributing commercially.
