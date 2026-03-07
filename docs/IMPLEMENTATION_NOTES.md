# Implementation behavior notes

## Output label format

**Use labels like:**
- Estimated launch region
- Approximate launch area
- Reverse corridor
- Confidence: High / Medium / Low (capitalized)

**Avoid labels like:**
- Exact launch site
- Confirmed launch point

## Launch region display (exact behavior)

- **Never** show "exact launch point" in UI or API responses.
- **Always** use one of: "estimated launch region" or "approximate launch area" (or short form "Est. launch region").
- Prefer **region polygons** over exact coordinates (show candidate polygons, not a single point).
- **If data is weak:** display broad "Western Iran (approximate)" only; do not show a specific sector name.
- **If inference is weak:** still allow screenshot; show **low-confidence** label clearly so the output is clearly qualified.

## Map display rules

| Element | Color / style |
|--------|----------------|
| Israel impacts (settlement pins) | **Red** |
| Impact cluster | **Purple** (fill + outline) |
| Reverse corridor | **Blue translucent** (fill + outline) |
| Candidate launch regions | **Yellow translucent** (fill + outline) |
| Best candidate (rank 1) | **Yellow, highlighted stronger** (e.g. thicker outline, higher opacity) |

These rules apply to the render/screenshot map and any map that shows inference results.
