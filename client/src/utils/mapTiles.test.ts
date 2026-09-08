import { resolveMapTiles } from "./mapTiles";

describe("resolveMapTiles", () => {
  it("uses OpenStreetMap when no Stadia key is configured", () => {
    const config = resolveMapTiles();

    expect(config.provider).toBe("openstreetmap");
    expect(config.url).toBe(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    );
    expect(config.attribution).toContain("OpenStreetMap contributors");
  });

  it("treats a whitespace-only Stadia key as missing", () => {
    expect(resolveMapTiles("   ").provider).toBe("openstreetmap");
  });

  it("uses an encoded Stadia key when one is configured", () => {
    const config = resolveMapTiles("public key/+");

    expect(config.provider).toBe("stadia");
    expect(config.url).toContain("alidade_smooth_dark");
    expect(config.url).toContain("api_key=public%20key%2F%2B");
    expect(config.attribution).toContain("Stadia Maps");
  });
});
