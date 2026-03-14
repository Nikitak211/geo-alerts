using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Server.Services.Telegram;

public sealed class TelegramService : ITelegramService
{
    private const string ApiBase = "https://api.telegram.org";
    private readonly TelegramOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TelegramService> _logger;

    public TelegramService(
        IOptions<TelegramOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<TelegramService> logger)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        if (IsConfigured)
            _logger.LogInformation("Telegram: configured (channel will receive photos when screenshot pipeline sends)");
        else
            _logger.LogInformation("Telegram: not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID to enable)");
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.BotToken) && !string.IsNullOrWhiteSpace(_options.ChannelId);

    public async Task<bool> SendPhotoAsync(string filePath, string? caption = null, CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            _logger.LogInformation("Telegram: skipped (BotToken or ChannelId not set)");
            return false;
        }

        if (!File.Exists(filePath))
        {
            _logger.LogWarning("Telegram: file not found, cannot send photo. Path: {Path}", filePath);
            return false;
        }

        _logger.LogInformation("Telegram: sending photo to channel. File: {Path}", filePath);

        var url = $"{ApiBase}/bot{_options.BotToken!.Trim()}/sendPhoto";
        var fileName = Path.GetFileName(filePath);

        using var client = _httpClientFactory.CreateClient();
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent(_options.ChannelId!.Trim(), Encoding.UTF8), "chat_id");

        await using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
        {
            var streamContent = new StreamContent(stream);
            streamContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            content.Add(streamContent, "photo", fileName);
            if (!string.IsNullOrWhiteSpace(caption))
            {
                content.Add(new StringContent(caption, Encoding.UTF8), "caption");
                content.Add(new StringContent("HTML", Encoding.UTF8), "parse_mode");
            }

            var response = await client.PostAsync(url, content, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            var json = JsonSerializer.Deserialize<JsonElement>(body);

            if (!response.IsSuccessStatusCode || !(json.TryGetProperty("ok", out var okProp) && okProp.GetBoolean()))
            {
                var desc = json.TryGetProperty("description", out var d) ? d.GetString() : body;
                _logger.LogError("Telegram API error: {Description}", desc);
                throw new InvalidOperationException(desc ?? "Telegram API error");
            }
        }

        _logger.LogInformation("Telegram: photo sent to channel");
        return true;
    }
}
