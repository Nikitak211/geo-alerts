using Microsoft.AspNetCore.Mvc;
using Server.Services.Telegram;

namespace Server.Controllers;

/// <summary>
/// Debug endpoints to verify Telegram config and send a test photo.
/// Screenshot generation (headless render) is not yet ported from Node — no automatic screenshots are sent.
/// When you have a PNG (e.g. from Node or manual), use send-photo to test the channel.
/// </summary>
[ApiController]
[Route("api/debug/telegram")]
public sealed class DebugTelegramController : ControllerBase
{
    private readonly ITelegramService _telegram;
    private readonly ILogger<DebugTelegramController> _logger;

    public DebugTelegramController(ITelegramService telegram, ILogger<DebugTelegramController> logger)
    {
        _telegram = telegram;
        _logger = logger;
    }

    /// <summary>GET /api/debug/telegram/status — returns whether Telegram is configured (token + channel set).</summary>
    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        _logger.LogInformation("Telegram: status requested. Configured: {Configured}", _telegram.IsConfigured);
        return Ok(new { configured = _telegram.IsConfigured });
    }

    /// <summary>POST /api/debug/telegram/send-photo — send an existing image file to the channel (for testing). Body: { "filePath": "C:\\path\\to\\image.png", "caption": "optional" }.</summary>
    [HttpPost("send-photo")]
    public async Task<IActionResult> SendPhoto([FromBody] SendPhotoRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request?.FilePath))
            return BadRequest(new { error = "filePath is required" });

        if (!_telegram.IsConfigured)
        {
            _logger.LogWarning(
                "Telegram send-photo skipped: not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID)");
            return BadRequest(new { error = "Telegram not configured", configured = false });
        }

        _logger.LogInformation("Telegram: send-photo requested. FilePath: {FilePath}", request.FilePath);
        try
        {
            var sent = await _telegram.SendPhotoAsync(request.FilePath, request.Caption, cancellationToken);
            _logger.LogInformation("Telegram: send-photo completed. Sent: {Sent}", sent);
            return Ok(new { ok = true, sent });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Telegram send-photo failed: {Message}", ex.Message);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    public sealed class SendPhotoRequest
    {
        public string? FilePath { get; set; }
        public string? Caption { get; set; }
    }
}
