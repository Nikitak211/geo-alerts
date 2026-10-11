using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Hosting;
using Server.Realtime;

namespace Server.Controllers;

[ApiController]
[Route("api/debug/realtime")]
public sealed class DebugRealtimeController : ControllerBase
{
    private readonly IAlertsNotifier _notifier;
    private readonly ILogger<DebugRealtimeController> _logger;
    private readonly IHostEnvironment _env;

    public DebugRealtimeController(IAlertsNotifier notifier, ILogger<DebugRealtimeController> logger, IHostEnvironment env)
    {
        _env = env;
        _notifier = notifier;
        _logger = logger;
    }

    [HttpPost("test-wallet")]
    public async Task<IActionResult> SendTestWalletUpdated()
    {
        // Debug-only: never let anonymous callers broadcast fake events in production.
        if (!_env.IsDevelopment()) return NotFound();

        var payload = new
        {
            userId = "debug-user",
            availableBalance = 123,
            reservedBalance = 0,
            reason = "debug"
        };

        await _notifier.WalletUpdatedAsync(payload);
        _logger.LogInformation("Sent debug wallet_updated event");

        return Ok(new { ok = true });
    }
}

