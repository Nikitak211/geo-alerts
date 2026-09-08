namespace Server.Services.News;

/// <summary>Valid WGS84 range (whole world).</summary>
public static class WorldBounds
{
    public static bool Contains(double lon, double lat) =>
        lon is >= -180 and <= 180 && lat is >= -90 and <= 90;
}

/// <summary>Kept for older tests/call sites — Middle East bbox (no longer used to filter news).</summary>
public static class MeBbox
{
    public const double MinLon = 24;
    public const double MaxLon = 63;
    public const double MinLat = 12;
    public const double MaxLat = 42;

    public static bool Contains(double lon, double lat) =>
        lon >= MinLon && lon <= MaxLon && lat >= MinLat && lat <= MaxLat;
}
