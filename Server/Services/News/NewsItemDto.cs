using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;

namespace Server.Services.News;

public sealed class NewsItemDto
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("title")]
    public required string Title { get; init; }

    [JsonPropertyName("summary")]
    public required string Summary { get; init; }

    [JsonPropertyName("url")]
    public required string Url { get; init; }

    [JsonPropertyName("lat")]
    public required double Lat { get; init; }

    [JsonPropertyName("lon")]
    public required double Lon { get; init; }

    [JsonPropertyName("type")]
    public required string Type { get; init; }

    [JsonPropertyName("seenAt")]
    public required string SeenAt { get; init; }

    [JsonPropertyName("domain")]
    public required string Domain { get; init; }

    [JsonPropertyName("imageUrl")]
    public string? ImageUrl { get; init; }
}

public static class NewsItemFactory
{
    public static string MakeId(string url, double lat, double lon, string title)
    {
        var raw = $"{url}|{lat:F4}|{lon:F4}|{title}";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(hash)[..16].ToLowerInvariant();
    }

    public static string MakeSummary(string title, string domain, string? seenAt)
    {
        var timeBit = string.IsNullOrWhiteSpace(seenAt) ? "" : $" · {seenAt}";
        var domainBit = string.IsNullOrWhiteSpace(domain) ? "" : $" ({domain})";
        var s = $"{title.Trim()}{domainBit}{timeBit}";
        return s.Length <= 200 ? s : s[..197] + "...";
    }

    public static string ExtractDomain(string? url)
    {
        var normalizedUrl = NormalizeHttpUrl(url);
        if (normalizedUrl is null) return "";
        var uri = new Uri(normalizedUrl);
        return uri.Host.StartsWith("www.", StringComparison.OrdinalIgnoreCase)
            ? uri.Host[4..]
            : uri.Host;
    }

    public static string? NormalizeHttpUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)) return null;
        if (uri.Scheme is not ("http" or "https") || string.IsNullOrWhiteSpace(uri.Host))
            return null;
        return uri.AbsoluteUri;
    }
}
