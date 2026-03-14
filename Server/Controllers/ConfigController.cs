using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Server.Controllers;

[ApiController]
[Route("api/config")]
public sealed class ConfigController : ControllerBase
{
    private readonly AppOptions _app;

    public ConfigController(IOptions<AppOptions> app)
    {
        _app = app.Value;
    }

    /// <summary>GET /api/config — client uses this at runtime to know whether to show the toolbar (avoids build-time env in Docker).</summary>
    [HttpGet]
    public IActionResult Get()
    {
        var activeToolbar = "true".Equals(_app.ActiveToolbar?.Trim(), StringComparison.OrdinalIgnoreCase);
        return Ok(new { activeToolbar });
    }
}
