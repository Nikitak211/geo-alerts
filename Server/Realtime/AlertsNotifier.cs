using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Server.Hubs;

namespace Server.Realtime;

public sealed class AlertsNotifier : IAlertsNotifier
{
    private readonly IHubContext<AlertsHub> _hubContext;
    private readonly ILogger<AlertsNotifier> _logger;

    public AlertsNotifier(IHubContext<AlertsHub> hubContext, ILogger<AlertsNotifier> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public Task BroadcastAsync(object message)
    {
        _logger.LogDebug("Broadcasting generic realtime message: {Message}", message);
        return _hubContext.Clients.All.SendAsync("message", message);
    }

    public Task WalletUpdatedAsync(object payload)
    {
        var envelope = new
        {
            type = "wallet_updated",
            payload
        };

        _logger.LogInformation("Broadcasting wallet_updated event");
        return _hubContext.Clients.All.SendAsync("message", envelope);
    }

    public Task InferenceResultAsync(object payload)
    {
        var envelope = new
        {
            type = "INFERENCE_RESULT",
            payload
        };

        _logger.LogInformation("Broadcasting INFERENCE_RESULT event");
        return _hubContext.Clients.All.SendAsync("message", envelope);
    }
}

