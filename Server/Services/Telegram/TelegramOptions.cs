namespace Server.Services.Telegram;

/// <summary>
/// Telegram Bot API config. Bind from Telegram section and env (Telegram__BotToken, TELEGRAM_BOT_TOKEN, etc.).
/// </summary>
public sealed class TelegramOptions
{
    public const string SectionName = "Telegram";

    public string? BotToken { get; set; }
    public string? ChannelId { get; set; }
    public string? ApiId { get; set; }
    public string? ApiHash { get; set; }
}
