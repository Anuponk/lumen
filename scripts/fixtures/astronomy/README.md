# Offline astronomy audit sources

- `western-lines.json`: unmodified constellation line arrays extracted from
  Stellarium Western at the commit and URL recorded in the file; data © Stellarium
  team, CC BY-SA. No text/illustration assets copied.
- `hipparcos-line-coordinates.json`: original `hip-lines.json` from Lumen import
  run 38136873670, artifact 11701895503; 691 HIP positions from Hipparcos II,
  F. van Leeuwen (2007), CDS VizieR I/311/hip2, ICRS J1991.25, degrees.

See [attribution and audit limits](../../../docs/ASTRONOMY_DATA_ATTRIBUTION.md).
These are offline verification inputs, never imported by the client. Do not
regenerate them from the projected runtime atlas: that would erase the independent
source-to-conversion check. An intentional source update requires an explicit
reference/license review and a new full audit; do not alter fixtures to hide a
failed comparison. Historical reward keys and source geometry remain separate.
