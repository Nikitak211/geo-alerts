using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Server.Realtime;
using Server.Services.Oref;

namespace Server.Services;

/// <summary>
/// Background service that polls OREF (or mock), normalizes payload, and broadcasts oref_update via SignalR.
/// Keeps the realtime channel active with real app-level messages the client can consume.
/// </summary>
public sealed class OrefPollingService : BackgroundService
{
    private readonly IAlertsNotifier _notifier;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<OrefPollingService> _logger;
    private readonly OrefOptions _options;

    public OrefPollingService(
        IAlertsNotifier notifier,
        IHttpClientFactory httpClientFactory,
        ILogger<OrefPollingService> logger,
        IOptions<OrefOptions> options)
    {
        _notifier = notifier;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var intervalMs = Math.Max(1000, _options.PollIntervalSeconds * 1000);
        _logger.LogInformation(
            "OREF polling started. Mode: {Mode}, interval: {Interval}s",
            _options.UseMock ? "mock" : "live",
            _options.PollIntervalSeconds);

        if (!_options.UseMock && string.IsNullOrWhiteSpace(_options.OrefUrl))
        {
            _logger.LogWarning(
                "Live OREF mode is on but OREF_URL is not set. Set OREF_URL (e.g. https://www.oref.org.il/WarningMessages/alert/alerts.json) so alerts can be fetched and broadcast.");
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                object? payload = _options.UseMock
                    ? await GetMockPayloadAsync(stoppingToken)
                    : await FetchLivePayloadAsync(stoppingToken);

                if (payload != null)
                {
                    var envelope = new
                    {
                        type = "oref_update",
                        ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                        payload
                    };
                    await _notifier.BroadcastAsync(envelope);
                    _logger.LogInformation("OREF broadcast sent (mode: {Mode})", _options.UseMock ? "mock" : "live");
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "OREF poll failed; will retry after interval");
            }

            await Task.Delay(intervalMs, stoppingToken);
        }

        _logger.LogInformation("OREF polling stopped");
    }

    /// <summary>Mock payload from OrefMockSamples (same data as server/src/oref/mock-samples.js). Picks one sample at random.</summary>
    private static Task<object> GetMockPayloadAsync(CancellationToken _)
    {
        var sample = OrefMockSamples.PickRandom();
        var mock = new
        {
            id = sample.Id,
            title = sample.Title,
            data = sample.Data,
            desc = sample.Desc,
            cat = sample.Cat
        };
        return Task.FromResult<object>(mock);
    }

    /// <summary>Fetch from live OREF URL; normalize minimally for client. Returns null on failure.</summary>
    private async Task<object?> FetchLivePayloadAsync(CancellationToken cancellationToken)
    {
        var url = _options.OrefUrl;
        if (string.IsNullOrWhiteSpace(url))
        {
            _logger.LogWarning("OREF URL not configured; skipping live fetch. Set OREF_URL for live alerts.");
            return null;
        }

        try
        {
            using var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(15);
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.TryAddWithoutValidation("Referer", "https://www.oref.org.il/");
            request.Headers.TryAddWithoutValidation("X-Requested-With", "XMLHttpRequest");
            request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (compatible; GeoAlerts/1.0)");
            var response = await client.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            var raw = ParseLivePayload(json);
            if (raw is null)
                return null;

            // Wrap raw API response in a payload shape the client can consume (id, title, data, desc, cat).
            var payload = NormalizeRawOref(raw.Value);
            return payload;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Live OREF fetch failed for {Url}", url);
            return null;
        }
    }

    /// <summary>
    /// Parses a live OREF response. OREF can represent "no alerts" as an empty
    /// array or as a NUL-filled body despite returning HTTP 200.
    /// </summary>
    public static JsonElement? ParseLivePayload(string payload)
    {
        var normalized = payload.Trim('\0', '\uFEFF', ' ', '\t', '\r', '\n');
        if (normalized.Length == 0)
            return null;

        var raw = JsonSerializer.Deserialize<JsonElement>(normalized);
        return raw.ValueKind == JsonValueKind.Array ? null : raw;
    }

    /// <summary>Map raw JSON to a minimal object matching client RawOrefPayload shape. Returns null if no alert data (e.g. empty data).</summary>
    private static object? NormalizeRawOref(JsonElement raw)
    {
        if (raw.ValueKind != JsonValueKind.Object)
            return null;

        var title = raw.TryGetProperty("title", out var t) ? t.GetString() : null;
        // API may use "data" or "cities" for the list of areas.
        var data = GetStringArray(raw, "data") ?? GetStringArray(raw, "cities") ?? Array.Empty<string>();
        if (data.Length == 0)
            return null;

        var desc = raw.TryGetProperty("desc", out var descProp) ? descProp.GetString() : null;
        var cat = raw.TryGetProperty("cat", out var catProp) ? catProp.GetString() : null;

        var eventTime = GetEventTimeFromPayload(raw);
        var id = raw.TryGetProperty("id", out var idProp) ? idProp.GetRawText().Trim('"') : null;
        if (string.IsNullOrEmpty(id))
            id = ComputeStableId(eventTime, data);

        return new { id, title, data, desc, cat };
    }

    private static string[]? GetStringArray(JsonElement raw, string propertyName)
    {
        if (!raw.TryGetProperty(propertyName, out var prop) || prop.ValueKind != JsonValueKind.Array)
            return null;
        return prop.EnumerateArray().Select(e => e.GetString() ?? "").ToArray();
    }

    /// <summary>Extract event time from payload (datetime / alertDate+alertTime / date+time) for stable id. Matches Node getAlertTimeFromPayload.</summary>
    private static string? GetEventTimeFromPayload(JsonElement raw)
    {
        if (raw.TryGetProperty("datetime", out var dt) && dt.ValueKind == JsonValueKind.String)
        {
            var s = dt.GetString();
            if (!string.IsNullOrEmpty(s) && s.Length >= 10 && s[4] == '-' && s[7] == '-' && s.Length > 10 && s[10] == 'T')
                return s;
        }
        if (raw.TryGetProperty("alertTime", out var at))
        {
            var atStr = at.GetString();
            if (!string.IsNullOrEmpty(atStr))
            {
                if (atStr.Length >= 10 && atStr[4] == '-' && atStr[7] == '-')
                    return atStr;
                if (raw.TryGetProperty("alertDate", out var ad))
                {
                    var adStr = ad.GetString();
                    if (!string.IsNullOrEmpty(adStr) && adStr.Length >= 10 && adStr[4] == '-' && adStr[7] == '-')
                        return $"{adStr}T{(atStr.Length >= 5 ? atStr.AsSpan(0, 5) : atStr)}:00";
                }
            }
        }
        if (raw.TryGetProperty("date", out var dateProp) && raw.TryGetProperty("time", out var timeProp))
        {
            var dateStr = dateProp.GetString();
            var timeStr = timeProp.GetString();
            if (!string.IsNullOrEmpty(dateStr) && !string.IsNullOrEmpty(timeStr) && dateStr.Length == 10 && dateStr[2] == '.' && dateStr[5] == '.')
            {
                // DD.MM.YYYY -> yyyy-mm-dd
                var yyyy = dateStr.AsSpan(6, 4);
                var mm = dateStr.AsSpan(3, 2);
                var dd = dateStr.AsSpan(0, 2);
                var t = timeStr.Length >= 5 ? timeStr.AsSpan(0, 5).ToString() : timeStr;
                return $"{yyyy}-{mm}-{dd}T{t}:00";
            }
        }
        if (raw.TryGetProperty("alertDate", out var ad2))
        {
            var s = ad2.GetString();
            if (!string.IsNullOrEmpty(s) && s.Length >= 10 && s[4] == '-' && s[7] == '-' && s.Length > 10 && s[10] == 'T')
                return s;
        }
        return null;
    }

    private static string ComputeStableId(string? eventTime, string[] data)
    {
        var payload = System.Text.Json.JsonSerializer.Serialize(new { eventTime, data });
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(bytes).ToLowerInvariant().AsSpan(0, 16).ToString();
    }
}

/// <summary>Configuration for OREF polling. Bind from Oref section and env (e.g. Oref__UseMock, USE_OREF_MOCK).</summary>
public sealed class OrefOptions
{
    public const string SectionName = "Oref";

    public bool UseMock { get; set; } = true;
    public int PollIntervalSeconds { get; set; } = 10;
    public string? OrefUrl { get; set; }
}
