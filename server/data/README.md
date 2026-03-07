# Server data folder

- **`municipalities.geojson`** — Put your GeoJSON here. The API serves it at **`GET /api/municipalities.geojson`** (streamed; not loaded into memory).
- You handle copying/transfer of the file; the server only streams it.
- For place matching (pins on the map), each feature should have **`properties.MUN_HEB`** (Hebrew name) and optionally **`properties.MUN_ENG`**. Example:

  ```json
  { "type": "Feature", "properties": { "MUN_HEB": "דרום השרון", "MUN_ENG": "Drom Hasharon" }, "geometry": { "type": "Polygon", "coordinates": [ ... ] } }
  ```

- If the file is missing or has `features: []`, the app will still work but place lookups will use the geocoding API only.
