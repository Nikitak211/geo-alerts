/**
 * Converts statisticalareas_2020_demography.gdb (ESRI File Geodatabase) to GeoJSON.
 * Run from client folder: node scripts/convert-gdb-to-geojson.js
 * Requires: npm install fgdb (dev)
 * Output: public/data/statisticalareas_2020_demography.geojson
 */

const path = require("path");
const fs = require("fs");

const GDB_PATH = path.join(__dirname, "..", "public", "data", "statisticalareas_2020_demography.gdb");
const OUT_PATH = path.join(__dirname, "..", "public", "data", "statisticalareas_2020_demography.geojson");

async function main() {
  if (!fs.existsSync(GDB_PATH)) {
    console.error("GDB not found at:", GDB_PATH);
    process.exit(1);
  }
  let fgdb;
  try {
    fgdb = require("fgdb");
  } catch (e) {
    console.error("Install fgdb first: npm install fgdb --save-dev");
    process.exit(1);
  }
  console.log("Reading", GDB_PATH, "...");
  const objectOfGeojson = await fgdb(GDB_PATH);
  const layerNames = Object.keys(objectOfGeojson);
  if (layerNames.length === 0) {
    console.error("No feature classes found in GDB");
    process.exit(1);
  }
  const firstLayer = layerNames[0];
  const geojson = objectOfGeojson[firstLayer];
  console.log("Using layer:", firstLayer, "features:", geojson?.features?.length ?? 0);
  if (!geojson || !geojson.features || geojson.features.length === 0) {
    console.error("Layer has no features");
    process.exit(1);
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(geojson), "utf8");
  console.log("Wrote", OUT_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
