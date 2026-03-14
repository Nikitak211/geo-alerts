/**
 * Test /api/geocode endpoint. Run with server already running on HTTP_PORT (8090).
 * Usage: node scripts/test-geocode.js [place]
 * Example: node scripts/test-geocode.js "שאר ישוב"
 */

const place = process.argv[2] || "שאר ישוב";
const base = process.env.GEOCODE_BASE || "http://localhost:8090";
const url = `${base}/api/geocode?place=${encodeURIComponent(place)}`;

console.log("GET", url);
console.log("");

fetch(url, { headers: { Accept: "application/json" } })
  .then((r) => {
    console.log("Status:", r.status, r.statusText);
    return r.text();
  })
  .then((text) => {
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      console.log("Body (not JSON):", text.slice(0, 200));
      return;
    }
    if (Array.isArray(json)) {
      console.log("Results:", json.length);
      if (json.length > 0) {
        const first = json[0];
        console.log("First:", first.display_name || first.name);
        console.log("Lat/Lon:", first.lat, first.lon);
        if (first.boundingbox) console.log("Bbox:", first.boundingbox);
      } else {
        console.log("(empty array)");
      }
    } else {
      console.log("Response:", JSON.stringify(json, null, 2));
    }
  })
  .catch((e) => {
    console.error("Error:", e.message);
    process.exitCode = 1;
  });
