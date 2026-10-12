using System.Globalization;
using System.Text.Json;

namespace Server.Services.News;

public interface IGdeltNewsService
{
    Task<IReadOnlyList<NewsItemDto>> GetWorldNewsAsync(CancellationToken ct = default);
    NewsStatusDto GetStatus();
}

/// <summary>
/// Proxies free GDELT DOC ArtList (no API key). World coverage via title geocode.
/// Skips broken GEO endpoint to avoid burning rate limit on 404s.
/// </summary>
public sealed class GdeltNewsService : IGdeltNewsService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan MinUpstreamInterval = TimeSpan.FromSeconds(5);
    // After a failure, don't call GDELT again until the cooldown passes (doubles per failure, capped).
    // Without this every /api/news request retried upstream, which keeps GDELT's 429 IP ban alive.
    private static readonly TimeSpan FailureCooldownMin = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan FailureCooldownMax = TimeSpan.FromMinutes(15);

    // Broad English news last 24h — geocoded to world places from titles.
    private const string DocUrl =
        "https://api.gdeltproject.org/api/v2/doc/doc"
        + "?query=(war%20OR%20conflict%20OR%20election%20OR%20earthquake%20OR%20protest%20OR%20summit%20OR%20missile%20OR%20refugee%20OR%20diplomacy%20OR%20NATO%20OR%20Ukraine%20OR%20China%20OR%20Russia%20OR%20Israel%20OR%20Gaza%20OR%20Iran)%20sourcelang%3Aenglish"
        + "&mode=ArtList&format=json&timespan=1d&maxrecords=100";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<GdeltNewsService> _logger;
    private readonly object _gate = new();
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    private IReadOnlyList<NewsItemDto>? _cache;
    private DateTimeOffset _cacheAt = DateTimeOffset.MinValue;
    private DateTimeOffset _lastUpstream = DateTimeOffset.MinValue;
    private DateTimeOffset _cooldownUntil = DateTimeOffset.MinValue;
    private int _consecutiveFailures;

    public GdeltNewsService(
        IHttpClientFactory httpClientFactory,
        ILogger<GdeltNewsService> logger,
        NewsCacheStore? cacheStore = null,
        IRssNewsSource? rssFallback = null)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _cacheStore = cacheStore;
        _rssFallback = rssFallback;
    }

    private static readonly TimeSpan RssMinInterval = TimeSpan.FromMinutes(2);
    private readonly NewsCacheStore? _cacheStore;
    private readonly IRssNewsSource? _rssFallback;
    private bool _diskLoaded;
    private string _cacheSource = "none";
    private string? _lastError;
    private DateTimeOffset _lastRssAttempt = DateTimeOffset.MinValue;

    /// <summary>Clock, overridable in tests.</summary>
    public Func<DateTimeOffset> Now { get; set; } = () => DateTimeOffset.UtcNow;

    public NewsStatusDto GetStatus()
    {
        EnsureDiskCacheLoaded();
        lock (_gate)
        {
            var count = _cache?.Count ?? 0;
            return new NewsStatusDto
            {
                Available = count > 0,
                Count = count,
                Source = count > 0 ? _cacheSource : "none",
                UpdatedAt = count > 0 ? _cacheAt.ToString("o", CultureInfo.InvariantCulture) : null,
                Stale = count > 0 && Now() - _cacheAt >= CacheTtl,
                LastError = _lastError,
            };
        }
    }

    private void EnsureDiskCacheLoaded()
    {
        if (_diskLoaded || _cacheStore is null) return;
        lock (_gate)
        {
            if (_diskLoaded) return;
            _diskLoaded = true;
            var snap = _cacheStore.Load();
            if (snap is { Items.Count: > 0 } && _cache is null)
            {
                _cache = snap.Items;
                _cacheAt = snap.SavedAt;
                _cacheSource = snap.Source;
                _logger.LogInformation("Loaded {Count} news items from disk cache ({Source}, saved {SavedAt:o})",
                    snap.Items.Count, snap.Source, snap.SavedAt);
            }
        }
    }

    private bool TryGetFresh(out IReadOnlyList<NewsItemDto> items)
    {
        lock (_gate)
        {
            if (_cache is not null && Now() - _cacheAt < CacheTtl)
            {
                items = _cache;
                return true;
            }
        }
        items = Array.Empty<NewsItemDto>();
        return false;
    }

    public async Task<IReadOnlyList<NewsItemDto>> GetWorldNewsAsync(CancellationToken ct = default)
    {
        EnsureDiskCacheLoaded();
        if (TryGetFresh(out var fresh))
            return fresh;

        await _refreshLock.WaitAsync(ct);
        try
        {
            if (TryGetFresh(out fresh))
                return fresh;

            IReadOnlyList<NewsItemDto>? items = null;
            var source = "gdelt";

            if (Now() >= _cooldownUntil)
                items = await TryGdeltAsync(ct);

            if ((items is null || items.Count == 0) && _rssFallback is not null && Now() - _lastRssAttempt >= RssMinInterval)
            {
                _lastRssAttempt = Now();
                try
                {
                    items = await _rssFallback.FetchAsync(ct);
                    source = "rss";
                    if (items.Count == 0)
                        _logger.LogWarning("RSS news fallback returned no items");
                    else
                        _logger.LogInformation("Serving {Count} news items from RSS fallback", items.Count);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "RSS news fallback failed");
                    _lastError = "All news sources unavailable";
                    items = null;
                }
            }

            if (items is { Count: > 0 })
            {
                lock (_gate)
                {
                    _cache = items;
                    _cacheAt = Now();
                    _cacheSource = source;
                }
                _lastError = null;
                _cacheStore?.Save(new NewsCacheSnapshot(items, _cacheAt, source));
                return items;
            }

            // Nothing new: serve the last good snapshot (possibly from disk) rather than failing.
            var snapshot = SnapshotOrEmpty();
            if (snapshot.Count > 0)
                return snapshot;
            throw new HttpRequestException(_lastError ?? "News upstream unavailable");
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    private async Task<IReadOnlyList<NewsItemDto>?> TryGdeltAsync(CancellationToken ct)
    {
        var wait = MinUpstreamInterval - (Now() - _lastUpstream);
        if (wait > TimeSpan.Zero)
            await Task.Delay(wait, ct);

        try
        {
            var client = _httpClientFactory.CreateClient(nameof(GdeltNewsService));
            using var docJson = await TryGetJsonAsync(client, DocUrl, ct);
            _lastUpstream = Now();
            if (docJson is null)
                throw new HttpRequestException("GDELT upstream did not return valid JSON");
            var items = ParseArtList(docJson.RootElement);
            if (items.Count == 0)
                _logger.LogWarning("GDELT upstream empty");
            _consecutiveFailures = 0;
            _cooldownUntil = DateTimeOffset.MinValue;
            return items;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _lastUpstream = Now();
            _consecutiveFailures++;
            var cooldown = TimeSpan.FromTicks(Math.Min(
                FailureCooldownMax.Ticks,
                FailureCooldownMin.Ticks * (1L << Math.Min(_consecutiveFailures - 1, 4))));
            _cooldownUntil = Now() + cooldown;
            _lastError = "GDELT unavailable";
            _logger.LogWarning(ex, "GDELT news fetch failed; next upstream attempt in {Cooldown}", cooldown);
            return null;
        }
    }

    private async Task<JsonDocument?> TryGetJsonAsync(HttpClient client, string url, CancellationToken ct)
    {
        try
        {
            using var response = await client.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("GDELT returned {Status} for {Host}", (int)response.StatusCode, new Uri(url).AbsolutePath);
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            return await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "GDELT request error");
            return null;
        }
    }

    private IReadOnlyList<NewsItemDto> SnapshotOrEmpty()
    {
        lock (_gate)
        {
            return _cache ?? Array.Empty<NewsItemDto>();
        }
    }

    public static IReadOnlyList<NewsItemDto> ParseFeatures(JsonElement root) => ParseGeoFeatures(root);

    public static IReadOnlyList<NewsItemDto> ParseGeoFeatures(JsonElement root)
    {
        if (!root.TryGetProperty("features", out var features) || features.ValueKind != JsonValueKind.Array)
            return Array.Empty<NewsItemDto>();

        var list = new List<NewsItemDto>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var feature in features.EnumerateArray())
        {
            if (!TryReadPoint(feature, out var lon, out var lat))
                continue;
            if (!WorldBounds.Contains(lon, lat))
                continue;

            var props = feature.TryGetProperty("properties", out var p) ? p : default;
            var name = GetString(props, "name") ?? GetString(props, "Name") ?? "World report";
            var url = GetString(props, "url") ?? GetString(props, "html") ?? "";
            var image = GetString(props, "shareimage") ?? GetString(props, "image");
            var count = GetInt(props, "count");

            if (string.IsNullOrWhiteSpace(url))
            {
                url = "https://api.gdeltproject.org/api/v2/doc/doc?query="
                    + Uri.EscapeDataString(name)
                    + "&mode=ArtList&format=html&timespan=1d";
            }

            var title = count > 0 ? $"{name} ({count} mentions)" : name;
            AddItem(list, seen, title, url, lat, lon, image, "last 24h");
        }

        return list;
    }

    /// <summary>Parse DOC ArtList JSON into world-geocoded news items.</summary>
    public static IReadOnlyList<NewsItemDto> ParseArtList(JsonElement root)
    {
        JsonElement articles;
        if (root.TryGetProperty("articles", out var a) && a.ValueKind == JsonValueKind.Array)
            articles = a;
        else if (root.ValueKind == JsonValueKind.Array)
            articles = root;
        else
            return Array.Empty<NewsItemDto>();

        var list = new List<NewsItemDto>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var art in articles.EnumerateArray())
        {
            var title = GetString(art, "title") ?? GetString(art, "Title");
            if (string.IsNullOrWhiteSpace(title))
                continue;
            if (!WorldPlaceGeocoder.TryGeocode(title, out var lat, out var lon))
                continue;

            var url = GetString(art, "url") ?? GetString(art, "url_mobile") ?? "";
            var image = GetString(art, "socialimage");
            var seenRaw = GetString(art, "seendate");
            var seenLabel = FormatSeen(seenRaw);

            AddItem(list, seen, title, url, lat, lon, image, seenLabel);
        }

        return list;
    }

    private static IReadOnlyList<NewsItemDto> ParseLatLonLines(JsonElement root)
    {
        // Some GDELT modes return { "points": [ { "lat":..,"lon":..,"name":.. } ] } or similar.
        if (!root.TryGetProperty("points", out var points) || points.ValueKind != JsonValueKind.Array)
            return Array.Empty<NewsItemDto>();

        var list = new List<NewsItemDto>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var pt in points.EnumerateArray())
        {
            if (!pt.TryGetProperty("lat", out var latEl) || !pt.TryGetProperty("lon", out var lonEl))
                continue;
            if (!latEl.TryGetDouble(out var lat) || !lonEl.TryGetDouble(out var lon))
                continue;
            if (!WorldBounds.Contains(lon, lat))
                continue;
            var name = GetString(pt, "name") ?? "World report";
            var url = GetString(pt, "url") ?? "";
            AddItem(list, seen, name, url, lat, lon, null, "last 24h");
        }
        return list;
    }

    internal static void AddItem(
        List<NewsItemDto> list,
        HashSet<string> seen,
        string title,
        string url,
        double lat,
        double lon,
        string? image,
        string seenLabel)
    {
        var fallbackUrl = "https://api.gdeltproject.org/api/v2/doc/doc?query="
            + Uri.EscapeDataString(title)
            + "&mode=ArtList&format=html&timespan=1d";
        var safeUrl = NewsItemFactory.NormalizeHttpUrl(url) ?? fallbackUrl;
        var safeDomain = NewsItemFactory.ExtractDomain(safeUrl);
        var newsType = NewsTypeClassifier.Classify(title);
        var seenAt = DateTimeOffset.UtcNow.ToString("o", CultureInfo.InvariantCulture);
        var id = NewsItemFactory.MakeId(safeUrl, lat, lon, title);
        if (!seen.Add(id))
            return;

        list.Add(new NewsItemDto
        {
            Id = id,
            Title = title,
            Summary = NewsItemFactory.MakeSummary(title, safeDomain, seenLabel),
            Url = safeUrl,
            Lat = lat,
            Lon = lon,
            Type = NewsTypeClassifier.ToApiString(newsType),
            SeenAt = seenAt,
            Domain = safeDomain,
            ImageUrl = NewsItemFactory.NormalizeHttpUrl(image),
        });
    }

    private static string FormatSeen(string? seendate)
    {
        if (string.IsNullOrWhiteSpace(seendate)) return "recent";
        // GDELT: 20240729T123000Z
        if (DateTimeOffset.TryParseExact(
                seendate,
                "yyyyMMdd'T'HHmmss'Z'",
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal,
                out var dto))
            return dto.ToString("u", CultureInfo.InvariantCulture);
        return seendate;
    }

    private static bool TryReadPoint(JsonElement feature, out double lon, out double lat)
    {
        lon = 0;
        lat = 0;
        if (!feature.TryGetProperty("geometry", out var geom))
            return false;
        if (!geom.TryGetProperty("coordinates", out var coords) || coords.ValueKind != JsonValueKind.Array)
            return false;
        if (coords.GetArrayLength() < 2)
            return false;

        return coords[0].TryGetDouble(out lon) && coords[1].TryGetDouble(out lat);
    }

    private static string? GetString(JsonElement props, string name)
    {
        if (props.ValueKind != JsonValueKind.Object)
            return null;
        if (!props.TryGetProperty(name, out var v))
            return null;
        return v.ValueKind == JsonValueKind.String ? v.GetString() : v.ToString();
    }

    private static int GetInt(JsonElement props, string name)
    {
        if (props.ValueKind != JsonValueKind.Object)
            return 0;
        if (!props.TryGetProperty(name, out var v))
            return 0;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n))
            return n;
        if (v.ValueKind == JsonValueKind.String && int.TryParse(v.GetString(), out n))
            return n;
        return 0;
    }
}
