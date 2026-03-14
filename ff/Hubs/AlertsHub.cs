using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace Server.Hubs;

public sealed class AlertsHub : Hub
{
    private readonly ILogger<AlertsHub> _logger;

    public AlertsHub(ILogger<AlertsHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected to AlertsHub: {ConnectionId}", Context.ConnectionId);

        var hello = new
        {
            type = "hello",
            ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };

        await Clients.Caller.SendAsync("message", hello);

        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client disconnected from AlertsHub: {ConnectionId}", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}

