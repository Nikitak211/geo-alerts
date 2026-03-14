using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Server.Models;
using Server.Services.Telegram;

namespace Server.Controllers;

/// <summary>
/// Alert-related API. GET /api/alerts/{id}/render-data for trajectory fallback;
/// POST /api/alerts/{id}/screenshot accepts client screenshot + metadata; backend forwards to Telegram only if AcceptClientScreenshots=true.
/// </summary>
[ApiController]
[Route("api/alerts")]
public sealed class AlertsController : ControllerBase
{
    private readonly ILogger<AlertsController> _logger;
    private readonly ITelegramService _telegram;
    private readonly AppOptions _appOptions;

    public AlertsController(ILogger<AlertsController> logger, ITelegramService telegram, IOptions<AppOptions> appOptions)
    {
        _logger = logger;
        _telegram = telegram;
        _appOptions = appOptions.Value;
    }

    /// <summary>GET /api/alerts/{id}/render-data — returns trajectory (empty until inference) and screenshot metadata (stub until capture pipeline).</summary>
    [HttpGet("{id}/render-data")]
    public IActionResult GetRenderData([FromRoute] string id)
    {
        _logger.LogInformation(
            "Render-data requested for alert {AlertId}; returning stub screenshot metadata and empty trajectory.",
            id);

        var response = new AlertRenderDataResponse
        {
            TrajectoryPolyline = Array.Empty<double[]>(),
            TrajectoryTarget = "iran",
            Screenshot = new ScreenshotMetadata
            {
                Available = false,
                Mode = "not_implemented",
                ImageUrl = null,
                CapturedAt = null,
                Source = null,
                Note = "Screenshot capture pipeline is not yet implemented in .NET.",
                Reference = new ScreenshotReference
                {
                    Available = true,
                    Type = "ui_example",
                    Description = "Reference screenshot exists for the expected map popup layout.",
                    FieldsShown = new[] { "location", "time", "lat", "long", "distance" },
                },
            },
        };

        return Ok(response);
    }

    /// <summary>POST /api/alerts/{id}/screenshot — client uploads screenshot image + metadata; server forwards to Telegram.</summary>
    [HttpPost("{id}/screenshot")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB
    [RequestFormLimits(MultipartBodyLengthLimit = 10 * 1024 * 1024)]
    public async Task<IActionResult> SubmitScreenshot(
        [FromRoute] string id,
        [FromForm] IFormFile? file,
        [FromForm] string? distanceKm,
        [FromForm] string? lat,
        [FromForm] string? lon,
        [FromForm] string? receivedAt,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Screenshot upload request for alert {AlertId} (file present: {HasFile}, Telegram configured: {TelegramOk}).", id, file != null && file.Length > 0, _telegram.IsConfigured);

        if (file == null || file.Length == 0)
        {
            _logger.LogWarning("Screenshot upload for alert {AlertId}: no file.", id);
            return BadRequest(new { error = "file is required" });
        }

        if (!_appOptions.AcceptClientScreenshots)
        {
            _logger.LogInformation("Screenshot upload for alert {AlertId}: accepted but not forwarded (ACCEPT_CLIENT_SCREENSHOTS=false).", id);
            await file.CopyToAsync(Stream.Null, cancellationToken);
            return Ok(new { ok = true, sent = false, skipped = "client screenshots disabled" });
        }

        if (!_telegram.IsConfigured)
        {
            _logger.LogWarning("Screenshot upload for alert {AlertId}: Telegram not configured.", id);
            return BadRequest(new { error = "Telegram not configured", configured = false });
        }

        var latParsed = double.TryParse(lat, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var latVal);
        var lonParsed = double.TryParse(lon, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var lonVal);
        var distanceParsed = double.TryParse(distanceKm, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var distanceVal);

        var time = !string.IsNullOrWhiteSpace(receivedAt) ? receivedAt.Trim() : DateTime.UtcNow.ToString("o");
        var lines = new List<string>();
        if (latParsed && lonParsed)
        {
            var url = $"https://www.google.com/maps?q={latVal.ToString(System.Globalization.CultureInfo.InvariantCulture)},{lonVal.ToString(System.Globalization.CultureInfo.InvariantCulture)}";
            lines.Add($"<a href=\"{url}\">Location</a>");
        }
        lines.Add($"Time: {time}");
        if (latParsed) lines.Add($"Lat: {latVal}");
        if (lonParsed) lines.Add($"Long: {lonVal}");
        if (distanceParsed) lines.Add($"Distance: {Math.Round(distanceVal)} km");
        var caption = string.Join("\n", lines);

        string tempPath = null!;
        try
        {
            var ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrEmpty(ext) || !ext.StartsWith('.')) ext = ".png";
            tempPath = Path.Combine(Path.GetTempPath(), $"alert-screenshot-{id}-{Guid.NewGuid():N}{ext}");
            await using (var stream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await file.CopyToAsync(stream, cancellationToken);
            }

            _logger.LogInformation("Screenshot received for alert {AlertId}; forwarding to Telegram.", id);
            var sent = await _telegram.SendPhotoAsync(tempPath, caption, cancellationToken);
            return Ok(new { ok = true, sent });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Screenshot upload/Telegram failed for alert {AlertId}.", id);
            return StatusCode(500, new { error = ex.Message });
        }
        finally
        {
            if (!string.IsNullOrEmpty(tempPath) && System.IO.File.Exists(tempPath))
            {
                try { System.IO.File.Delete(tempPath); } catch { /* ignore */ }
            }
        }
    }
}
