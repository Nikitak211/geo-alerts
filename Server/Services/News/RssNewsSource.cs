using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

namespace Server.Services.News;

public interface IRssNewsSource
{
    Task<IReadOnlyList<NewsItemDto>> FetchAsync(CancellationToken ct = default);
}

/// <summary>
/// Fallback news source used while GDELT is unavailable: plain RSS 2.0 feeds (default: Times of
/// Israel, English, so the existing English place geocoder works). Items whose title/description
/// name no known place are pinned to a default point in Israel, since the default feed is Israel news.
/// </summary>
public sealed partial class RssNewsSource : IRssNewsSource
{
    public const string HttpClientName = "news-rss";
    public static readonly string[] DefaultFeeds = ["https://www.timesofisrael.com/feed/"];
    private const double DefaultLat = 31.7683, DefaultLon = 35.2137; // Jerusalem
    private const int MaxItemsPerFeed = 40;

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<RssNewsSource> _logger;
    private readonly IReadOnlyList<string> _feeds;

    public RssNewsSource(IHttpClientFactory httpClientFactory, ILogger<RssNewsSource> logger, IReadOnlyList<string>? feeds = null)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _feeds = feeds is { Count: > 0 } ? feeds : DefaultFeeds;
    }

    public async Task<IReadOnlyList<NewsItemDto>> FetchAsync(CancellationToken ct = default)
    {
        var client = _httpClientFactory.CreateClient(HttpClientName);
        var all = new List<NewsItemDto>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        Exception? last = null;
        foreach (var feed in _feeds)
        {
            try
            {
                using var resp = await client.GetAsync(feed, ct);
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("RSS feed {Feed} returned {Status}", feed, (int)resp.StatusCode);
                    continue;
                }
                await using var stream = await resp.Content.ReadAsStreamAsync(ct);
                foreach (var item in Parse(stream))
                    if (seen.Add(item.Id)) all.Add(item);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                last = ex;
                _logger.LogWarning(ex, "RSS feed {Feed} failed", feed);
            }
        }
        if (all.Count == 0 && last is not null) throw new HttpRequestException("All RSS feeds failed", last);
        return all;
    }

    public static IReadOnlyList<NewsItemDto> Parse(Stream xml)
    {
        var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, Async = false };
        using var reader = XmlReader.Create(xml, settings);
        var doc = XDocument.Load(reader);
        XNamespace media = "http://search.yahoo.com/mrss/";

        var list = new List<NewsItemDto>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in doc.Descendants("item").Take(MaxItemsPerFeed))
        {
            var title = Clean(item.Element("title")?.Value);
            var link = item.Element("link")?.Value?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(title) || NewsItemFactory.NormalizeHttpUrl(link) is null) continue;
            var desc = Clean(item.Element("description")?.Value);

            if (!WorldPlaceGeocoder.TryGeocode(title, out var lat, out var lon)
                && !WorldPlaceGeocoder.TryGeocode(desc, out lat, out lon))
            {
                lat = DefaultLat;
                lon = DefaultLon;
            }

            var image = item.Element(media + "content")?.Attribute("url")?.Value
                ?? item.Element(media + "thumbnail")?.Attribute("url")?.Value
                ?? item.Elements("enclosure").FirstOrDefault(e => (e.Attribute("type")?.Value ?? "").StartsWith("image/"))?.Attribute("url")?.Value;

            var seenLabel = DateTimeOffset.TryParse(item.Element("pubDate")?.Value, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal, out var pub)
                ? pub.ToUniversalTime().ToString("u", CultureInfo.InvariantCulture)
                : "recent";

            GdeltNewsService.AddItem(list, seen, title, link, lat, lon, image, seenLabel);
        }
        return list;
    }

    private static string Clean(string? s) =>
        string.IsNullOrWhiteSpace(s) ? "" : WebUtility.HtmlDecode(TagRegex().Replace(s, " ")).Trim();

    [GeneratedRegex("<[^>]+>")]
    private static partial Regex TagRegex();
}
