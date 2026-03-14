using Microsoft.Extensions.DependencyInjection;
using Server.Hubs;
using Server.Realtime;
using Server.Services;
using Server.Services.Telegram;

var builder = WebApplication.CreateBuilder(args);

// Bind strongly-typed configuration for application-level settings.
builder.Services.Configure<AppOptions>(builder.Configuration.GetSection("App"));
builder.Services.PostConfigure<AppOptions>(options =>
{
    if (Environment.GetEnvironmentVariable("ACCEPT_CLIENT_SCREENSHOTS") is { } envVal)
        options.AcceptClientScreenshots = envVal.Equals("true", StringComparison.OrdinalIgnoreCase);
    if (Environment.GetEnvironmentVariable("App__ActiveToolbar") is { } toolbarEnv)
        options.ActiveToolbar = toolbarEnv.Equals("true", StringComparison.OrdinalIgnoreCase);
});
builder.Services.Configure<OrefOptions>(options =>
{
    var config = builder.Configuration;
    options.UseMock = config.GetValue<bool>("Oref:UseMock");
    options.PollIntervalSeconds = config.GetValue("Oref:PollIntervalSeconds", 10);
    options.OrefUrl = config["Oref:OrefUrl"];
    // Legacy env vars (e.g. Docker / Node parity)
    if (Environment.GetEnvironmentVariable("USE_OREF_MOCK") is { } useMockEnv)
        options.UseMock = useMockEnv.Equals("true", StringComparison.OrdinalIgnoreCase);
    if (Environment.GetEnvironmentVariable("OREF_POLL_INTERVAL_SECONDS") is { } intervalEnv && int.TryParse(intervalEnv, out var sec))
        options.PollIntervalSeconds = Math.Max(1, sec);
    if (Environment.GetEnvironmentVariable("OREF_URL") is { } urlEnv)
        options.OrefUrl = urlEnv;
});

builder.Services.Configure<TelegramOptions>(options =>
{
    var config = builder.Configuration;
    options.BotToken = config["Telegram:BotToken"];
    options.ChannelId = config["Telegram:ChannelId"];
    options.ApiId = config["Telegram:ApiId"];
    options.ApiHash = config["Telegram:ApiHash"];
    if (Environment.GetEnvironmentVariable("TELEGRAM_BOT_TOKEN") is { } token)
        options.BotToken = token;
    if (Environment.GetEnvironmentVariable("TELEGRAM_CHANNEL_ID") is { } channel)
        options.ChannelId = channel;
    if (Environment.GetEnvironmentVariable("TELEGRAM_API_ID") is { } apiId)
        options.ApiId = apiId;
    if (Environment.GetEnvironmentVariable("TELEGRAM_API_HASH") is { } apiHash)
        options.ApiHash = apiHash;
});

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddSignalR(options =>
{
    // Keepalive: server pings client every 5s so the connection never goes idle.
    options.KeepAliveInterval = TimeSpan.FromSeconds(5);
    // Only consider client disconnected after 10 minutes without any message (pong).
    options.ClientTimeoutInterval = TimeSpan.FromMinutes(10);
});

// CORS: enabled only for development to allow the existing React dev server
// to call the API when running separately from the .NET backend.
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCorsPolicy", policyBuilder =>
    {
        var corsOrigin = builder.Configuration.GetSection("App")["CorsOrigin"];
        if (!string.IsNullOrWhiteSpace(corsOrigin))
        {
            policyBuilder.WithOrigins(corsOrigin);
        }
        else
        {
            policyBuilder.AllowAnyOrigin();
        }

        policyBuilder
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddSingleton<IAlertsNotifier, AlertsNotifier>();
builder.Services.AddHttpClient();
builder.Services.AddSingleton<ITelegramService, TelegramService>();
builder.Services.AddHostedService<OrefPollingService>();

var app = builder.Build();

// Log Telegram and screenshot status at startup (so Docker logs show why no screenshot/telegram)
using (var scope = app.Services.CreateScope())
{
    var telegram = scope.ServiceProvider.GetRequiredService<ITelegramService>();
    app.Logger.LogInformation(
        "Screenshot: pipeline not implemented in .NET (no headless capture). Telegram: {TelegramStatus}.",
        telegram.IsConfigured ? "configured (will send when screenshot exists)" : "not configured");
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseCors("DevCorsPolicy");
}

// Serve static files from wwwroot (for the built React client in production).
app.UseStaticFiles();

app.UseRouting();

// Map API controllers under /api/*.
app.MapControllers();

// Realtime hub for alerts, wallet events, and other websocket-style messages.
app.MapHub<AlertsHub>("/ws");

// Fallback to index.html for client-side routing (SPA).
app.MapFallbackToFile("index.html");

app.Run();

public sealed class AppOptions
{
    public int HttpPort { get; init; }

    public string? CorsOrigin { get; init; }

    public string? ClientBaseUrl { get; init; }

    public string? WebSocketPath { get; init; }

    /// <summary>If false, accept client screenshots but do not forward to Telegram.</summary>
    public bool AcceptClientScreenshots { get; set; } = true;

    /// <summary>If true, show the main app toolbar (login, wallet, bets). Exposed at GET /api/config for the client.</summary>
    public bool ActiveToolbar { get; set; }
}
