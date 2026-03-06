const path = require("path");
const fs = require("fs-extra");

const cesiumSource = "node_modules/cesium/Build/Cesium";
const cesiumDest = "public/cesium";

async function copy() {
  await fs.remove(cesiumDest);
  await fs.copy(cesiumSource, cesiumDest);
  console.log("Cesium copied to", cesiumDest);
}

copy();
