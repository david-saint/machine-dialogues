# Archived judgments — schema v1

Judgments produced under schema v1 (single `decision.winner` field, which
conflated "who is right on the proposition" with "who argued better").
Archived 2026-07-06 before the v2 rerun, which splits the decision into
`resolution_winner` and `craft_winner` and enforces one judge per model
family. `schema.json` in this directory is the v1 schema these files
validate against.

These files are kept for before/after comparison of the family-bias
analysis; the viewer's data build intentionally ignores this subtree.
