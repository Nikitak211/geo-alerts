using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Server.Realtime;

namespace Server.Controllers;

[ApiController]
[Route("api/debug/realtime")]
public sealed class DebugRealtimeController : ControllerBase
{
    private readonly IAlertsNotifier _notifier;
    private readonly ILogger<DebugRealtimeController> _logger;

    public DebugRealtimeController(IAlertsNotifier notifier, ILogger<DebugRealtimeController> logger)
    {
        _notifier = notifier;
        _logger = logger;
    }

    [HttpPost("test-wallet")]
    public async Task<IActionResult> SendTestWalletUpdated()
    {
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

