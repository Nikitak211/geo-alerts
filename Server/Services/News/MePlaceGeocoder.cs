namespace Server.Services.News;

/// <summary>
/// Static world place centroids for geocoding article titles (no API key).
/// Longer needles first so "united states" wins over ambiguous short tokens.
/// </summary>
public static class WorldPlaceGeocoder
{
    private static readonly (string Needle, double Lat, double Lon)[] Places =
    [
        // Multi-word / specific first
        ("united states", 38.9072, -77.0369),
        ("united kingdom", 51.5074, -0.1278),
        ("saudi arabia", 24.7136, 46.6753),
        ("south korea", 37.5665, 126.9780),
        ("north korea", 39.0392, 125.7625),
        ("south africa", -25.7479, 28.2293),
        ("new zealand", -41.2865, 174.7762),
        ("hong kong", 22.3193, 114.1694),
        ("sri lanka", 6.9271, 79.8612),
        ("west bank", 31.9522, 35.2332),
        ("red sea", 20.0000, 38.0000),
        ("strait of hormuz", 26.5667, 56.2500),
        ("khan younis", 31.3402, 34.3063),
        ("tel aviv", 32.0853, 34.7818),
        ("abu dhabi", 24.4539, 54.3773),
        ("new york", 40.7128, -74.0060),
        ("los angeles", 34.0522, -118.2437),
        ("san francisco", 37.7749, -122.4194),
        ("washington", 38.9072, -77.0369),
        ("buenos aires", -34.6037, -58.3816),
        ("mexico city", 19.4326, -99.1332),
        ("cape town", -33.9249, 18.4241),
        ("kuala lumpur", 3.1390, 101.6869),
        ("ho chi minh", 10.8231, 106.6297),
        // ME
        ("gaza", 31.5017, 34.4668),
        ("rafah", 31.2969, 34.2452),
        ("jerusalem", 31.7683, 35.2137),
        ("haifa", 32.7940, 34.9896),
        ("beirut", 33.8938, 35.5018),
        ("lebanon", 33.8547, 35.8623),
        ("hezbollah", 33.8547, 35.8623),
        ("damascus", 33.5138, 36.2765),
        ("syria", 34.8021, 38.9968),
        ("tehran", 35.6892, 51.3890),
        ("iran", 32.4279, 53.6880),
        ("baghdad", 33.3152, 44.3661),
        ("iraq", 33.2232, 43.6793),
        ("sanaa", 15.3694, 44.1910),
        ("yemen", 15.5527, 48.5164),
        ("houthi", 15.5527, 48.5164),
        ("amman", 31.9454, 35.9284),
        ("jordan", 30.5852, 36.2384),
        ("cairo", 30.0444, 31.2357),
        ("egypt", 26.8206, 30.8025),
        ("sinai", 29.5000, 34.0000),
        ("riyadh", 24.7136, 46.6753),
        ("dubai", 25.2048, 55.2708),
        ("doha", 25.2854, 51.5310),
        ("qatar", 25.3548, 51.1839),
        ("kuwait", 29.3759, 47.9774),
        ("bahrain", 26.0667, 50.5577),
        ("oman", 21.4735, 55.9754),
        ("israel", 31.0461, 34.8516),
        ("palestine", 31.9522, 35.2332),
        ("hormuz", 26.5667, 56.2500),
        ("uae", 23.4241, 53.8478),
        // Europe
        ("ukraine", 48.3794, 31.1656),
        ("kyiv", 50.4501, 30.5234),
        ("kiev", 50.4501, 30.5234),
        ("moscow", 55.7558, 37.6173),
        ("russia", 61.5240, 105.3188),
        ("london", 51.5074, -0.1278),
        ("paris", 48.8566, 2.3522),
        ("berlin", 52.5200, 13.4050),
        ("rome", 41.9028, 12.4964),
        ("madrid", 40.4168, -3.7038),
        ("warsaw", 52.2297, 21.0122),
        ("poland", 51.9194, 19.1451),
        ("brussels", 50.8503, 4.3517),
        ("nato", 50.8503, 4.3517),
        ("stockholm", 59.3293, 18.0686),
        ("oslo", 59.9139, 10.7522),
        ("athens", 37.9838, 23.7275),
        ("greece", 39.0742, 21.8243),
        ("turkey", 38.9637, 35.2433),
        ("ankara", 39.9334, 32.8597),
        ("istanbul", 41.0082, 28.9784),
        ("france", 46.2276, 2.2137),
        ("germany", 51.1657, 10.4515),
        ("italy", 41.8719, 12.5674),
        ("spain", 40.4637, -3.7492),
        ("britain", 51.5074, -0.1278),
        ("england", 51.5074, -0.1278),
        ("europe", 50.0, 10.0),
        // Asia-Pacific
        ("beijing", 39.9042, 116.4074),
        ("shanghai", 31.2304, 121.4737),
        ("china", 35.8617, 104.1954),
        ("taiwan", 23.6978, 120.9605),
        ("taipei", 25.0330, 121.5654),
        ("tokyo", 35.6762, 139.6503),
        ("japan", 36.2048, 138.2529),
        ("seoul", 37.5665, 126.9780),
        ("pyongyang", 39.0392, 125.7625),
        ("korea", 37.5665, 126.9780),
        ("delhi", 28.7041, 77.1025),
        ("mumbai", 19.0760, 72.8777),
        ("india", 20.5937, 78.9629),
        ("islamabad", 33.6844, 73.0479),
        ("pakistan", 30.3753, 69.3451),
        ("kabul", 34.5553, 69.2075),
        ("afghanistan", 33.9391, 67.7100),
        ("bangkok", 13.7563, 100.5018),
        ("thailand", 15.8700, 100.9925),
        ("manila", 14.5995, 120.9842),
        ("philippines", 12.8797, 121.7740),
        ("jakarta", -6.2088, 106.8456),
        ("indonesia", -0.7893, 113.9213),
        ("sydney", -33.8688, 151.2093),
        ("australia", -25.2744, 133.7751),
        ("singapore", 1.3521, 103.8198),
        ("vietnam", 14.0583, 108.2772),
        ("asia", 34.0, 100.0),
        // Americas
        ("america", 38.9072, -77.0369),
        ("usa", 38.9072, -77.0369),
        ("canada", 56.1304, -106.3468),
        ("ottawa", 45.4215, -75.6972),
        ("toronto", 43.6532, -79.3832),
        ("mexico", 23.6345, -102.5528),
        ("brazil", -14.2350, -51.9253),
        ("brasilia", -15.8267, -47.9218),
        ("argentina", -38.4161, -63.6167),
        ("chile", -35.6751, -71.5430),
        ("santiago", -33.4489, -70.6693),
        ("colombia", 4.5709, -74.2973),
        ("bogota", 4.7110, -74.0721),
        ("venezuela", 6.4238, -66.5897),
        ("cuba", 21.5218, -77.7812),
        ("havana", 23.1136, -82.3666),
        ("ohio", 40.4173, -82.9071),
        // Africa
        ("nigeria", 9.0820, 8.6753),
        ("lagos", 6.5244, 3.3792),
        ("kenya", -0.0236, 37.9062),
        ("nairobi", -1.2921, 36.8219),
        ("ethiopia", 9.1450, 40.4897),
        ("addis ababa", 9.0320, 38.7469),
        ("sudan", 12.8628, 30.2176),
        ("khartoum", 15.5007, 32.5599),
        ("somalia", 5.1521, 46.1996),
        ("libya", 26.3351, 17.2283),
        ("tripoli", 32.8872, 13.1913),
        ("tunisia", 33.8869, 9.5375),
        ("algeria", 28.0339, 1.6596),
        ("morocco", 31.7917, -7.0926),
        ("africa", 0.0, 20.0),
    ];

    public static bool TryGeocode(string? title, out double lat, out double lon)
    {
        lat = 0;
        lon = 0;
        if (string.IsNullOrWhiteSpace(title)) return false;
        var lower = title.ToLowerInvariant();
        foreach (var (needle, plat, plon) in Places)
        {
            if (lower.Contains(needle, StringComparison.Ordinal))
            {
                lat = plat;
                lon = plon;
                return WorldBounds.Contains(lon, lat);
            }
        }
        return false;
    }
}

/// <summary>Backward-compatible alias.</summary>
public static class MePlaceGeocoder
{
    public static bool TryGeocode(string? title, out double lat, out double lon) =>
        WorldPlaceGeocoder.TryGeocode(title, out lat, out lon);
}
