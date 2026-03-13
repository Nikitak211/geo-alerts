# Pipeline execution order

Implement and maintain in this exact order:

1. **Isolate OREF ingestion** — `server/src/ingest/oref` (fetch, parse, dedupe, publish). Raw OREF only here.
2. **Create domain types** — `server/src/domain/alerts` (AlertEvent, AlertCluster, ReverseCorridor, etc.).
3. Implement settlement resolver
4. Implement cluster builder
5. Implement reverse corridor math
6. Load Iran candidate regions from GeoJSON
7. Implement scoring and ranking
8. Create runInference orchestrator
9. Expose inference API
10. Connect WebSocket publishing
11. Create screenshot render page
12. Create screenshot worker
13. Trigger screenshot jobs
14. Persist outputs
15. Add replay mode
16. Add tests

**Rules:** Small focused files, TypeScript first, no giant all-in-one module, render logic separate from inference logic, return GeoJSON where possible, comments only where math is non-obvious, do not refactor unrelated app parts.
