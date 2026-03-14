namespace Server.Services.Telegram;

/// <summary>
/// Send photos (e.g. alert screenshots) to a Telegram channel via Bot API.
/// Configure Telegram:BotToken and Telegram:ChannelId (or env TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID).
/// </summary>
public interface ITelegramService
{
    /// <summary>True if token and channel are configured.</summary>
    bool IsConfigured { get; }

    /// <summary>Send a local image file to the configured channel. No-op if not configured. Throws on API error.</summary>
    Task<bool> SendPhotoAsync(string filePath, string? caption = null, CancellationToken cancellationToken = default);
}
