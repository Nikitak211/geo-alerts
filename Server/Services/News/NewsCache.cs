using System.Text.Json;
using System.Text.Json.Serialization;

namespace Server.Services.News;

public sealed class NewsStatusDto
{
    [JsonPropertyName("available")] public bool Available { get; init; }
    [JsonPropertyName("count")] public int Count { get; init; }
    /// <summary>"gdelt", "rss" or "none".</summary>
    [JsonPropertyName("source")] public string Source { get; init; } = "none";
    [JsonPropertyName("updatedAt")] public string? UpdatedAt { get; init; }
    [JsonPropertyName("stale")] public bool Stale { get; init; }
    [JsonPropertyName("lastError")] public string? LastError { get; init; }
}

public sealed record NewsCacheSnapshot(IReadOnlyList<NewsItemDto> Items, DateTimeOffset SavedAt, string Source);

/// <summary>
/// Persists the last good news list to a JSON file so a container restart (or a long upstream
/// outage) still has something to show. All IO errors are logged and ignored.
/// </summary>
public sealed class NewsCacheStore
{
    private readonly string? _path;
    private readonly ILogger<NewsCacheStore> _logger;
    private readonly object _io = new();

    private sealed class FileModel
    {
        public string Source { get; set; } = "none";
        public DateTimeOffset SavedAt { get; set; }
        public List<NewsItemDto> Items { get; set; } = new();
    }

    public NewsCacheStore(string? path, ILogger<NewsCacheStore> logger)
    {
        _path = string.IsNullOrWhiteSpace(path) ? null : path;
        _logger = logger;
    }

    public NewsCacheSnapshot? Load()
    {
        if (_path is null || !File.Exists(_path)) return null;
        try
        {
            lock (_io)
            {
                var model = JsonSerializer.Deserialize<FileModel>(File.ReadAllText(_path));
                if (model is null || model.Items.Count == 0) return null;
                return new NewsCacheSnapshot(model.Items, model.SavedAt, model.Source);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not read news cache {Path}", _path);
            return null;
        }
    }

    public void Save(NewsCacheSnapshot snapshot)
    {
        if (_path is null) return;
        try
        {
            lock (_io)
            {
                var dir = Path.GetDirectoryName(_path);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
                var tmp = _path + ".tmp";
                File.WriteAllText(tmp, JsonSerializer.Serialize(new FileModel
                {
                    Source = snapshot.Source,
                    SavedAt = snapshot.SavedAt,
                    Items = snapshot.Items.ToList(),
                }));
                File.Move(tmp, _path, overwrite: true);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not write news cache {Path}", _path);
        }
    }
}
