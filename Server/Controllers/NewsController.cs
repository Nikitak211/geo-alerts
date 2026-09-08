using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Server.Services.News;

namespace Server.Controllers;

[ApiController]
[Route("api/news")]
[EnableRateLimiting("news")]
public sealed class NewsController : ControllerBase
{
    private readonly IGdeltNewsService _news;

    public NewsController(IGdeltNewsService news)
    {
        _news = news;
    }

    /// <summary>GET /api/news — worldwide news points (GDELT DOC proxy, cached).</summary>
    [HttpGet]
    public Task<IActionResult> GetWorld(CancellationToken ct) => GetInternal(ct);

    /// <summary>GET /api/news/world — same as GET /api/news.</summary>
    [HttpGet("world")]
    public Task<IActionResult> GetWorldAlias(CancellationToken ct) => GetInternal(ct);

    /// <summary>GET /api/news/me — legacy alias for world news.</summary>
    [HttpGet("me")]
    public Task<IActionResult> GetLegacyMe(CancellationToken ct) => GetInternal(ct);

    private async Task<IActionResult> GetInternal(CancellationToken ct)
    {
        try
        {
            var items = await _news.GetWorldNewsAsync(ct);
            return Ok(new { success = true, data = items, error = (string?)null });
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            return StatusCode(502, new { success = false, data = Array.Empty<object>(), error = "News upstream unavailable" });
        }
    }
}
