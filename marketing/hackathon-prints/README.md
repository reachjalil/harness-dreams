# Harness Health hackathon prints

Final judge handouts are raster PNGs in `final/`.

The product UI inside each print comes from actual demo-mode renderer
screenshots in `screenshots/`. The generated design treatment comes from
`generated/coolguide-background.png`; no fake app screens or generated UI
mockups are used.

Print set:

1. `final/01-overview.png` - A health review for coding agents.
2. `final/02-health-review.png` - The report is grounded in actual friction.
3. `final/03-apply-ready-recommendations.png` - From quote to apply-ready change.
4. `final/04-privacy-and-runner.png` - Local by default. Cloud only by opt-in.
5. `final/05-demo-walkthrough.png` - Three-minute judge walkthrough.

Regenerate with:

```bash
python3 marketing/hackathon-prints/generate-final-pngs.py
```
