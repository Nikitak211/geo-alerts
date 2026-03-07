# OREF trajectory feature

Visual back-projected approach line for eligible rocket alerts (title "ירי רקטות וטילים", exactly 3 areas). Renders pins + polyline from border-proximity to impact centroid.

## Known limitations

This architecture gives a **visual estimated path only**. It is **not**:

- Real launch origin
- Real missile arc
- Interception path
- True heading from radar

It is a **heuristic back-projected approach line** — useful for entry-side visualization, not for tactical accuracy.

## Best next upgrade

After the first version works, the next improvement should be:

- **Maintain recent alert history** for 30–90 seconds
- **Cluster multiple rocket alerts** in that window
- **Compare temporal sequence** (order of impacts / centroids)
- **Produce stronger direction confidence** from the cluster
- **Reduce weird lines** from noisy 3-point spreads (single-alert outliers)

## Best final instruction to Cursor

Use this exact instruction when iterating on this feature:

> I want a clean, production-style implementation with small focused files, strong types, no any, no dead code, and safe handling of malformed websocket payloads. Keep the trajectory logic isolated from React rendering. Use React hooks for data flow and Resium components only for visualization.
