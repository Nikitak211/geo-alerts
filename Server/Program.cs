using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using System.Threading.RateLimiting;
using Server.Hubs;
using Server.Realtime;
using Server.Services;
using Server.Services.News;
using Server.Services.Telegram;

var builder = WebApplication.CreateBuilder(args);

// Bind strongly-typed configuration for application-level settings.
builder.Services.Configure<AppOptions>(builder.Configuration.GetSection("App"));
builder.Services.PostConfigure<AppOptions>(options =>
{
    if (Environment.GetEnvironmentVariable("ACCEPT_CLIENT_SCREENSHOTS") is { } envVal)
        options.AcceptClientScreenshots = envVal.Equals("true", StringComparison.OrdinalIgnoreCase);
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
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("news", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});
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
builder.Services.AddHttpClient(nameof(GdeltNewsService), client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("geo-alerts-news/1.0");
});
builder.Services.AddSingleton<IGdeltNewsService, GdeltNewsService>();
builder.Services.AddSingleton<ITelegramService, TelegramService>();
builder.Services.AddHostedService<OrefPollingService>();

var app = builder.Build();

// Log loaded config at startup (no secrets) so Docker/logs show that envs were applied
using (var scope = app.Services.CreateScope())
{
    var appOptions = scope.ServiceProvider.GetRequiredService<IOptions<AppOptions>>().Value;
    var orefOptions = scope.ServiceProvider.GetRequiredService<IOptions<OrefOptions>>().Value;
    var telegram = scope.ServiceProvider.GetRequiredService<ITelegramService>();

    var activeToolbar = "true".Equals(appOptions.ActiveToolbar?.Trim(), StringComparison.OrdinalIgnoreCase);
    var dbConn = builder.Configuration["ConnectionStrings:DefaultDatabase"] ?? "";
    var dbSafe = string.IsNullOrEmpty(dbConn) ? "(not set)" : MaskConnectionString(dbConn);

    app.Logger.LogInformation(
        "Config loaded: App.CorsOrigin={CorsOrigin}, App.ClientBaseUrl={ClientBaseUrl}, App.WebSocketPath={WebSocketPath}, App.AcceptClientScreenshots={AcceptClientScreenshots}, App.ActiveToolbar={ActiveToolbar} (parsed={ActiveToolbarParsed})",
        appOptions.CorsOrigin ?? "(null)",
        appOptions.ClientBaseUrl ?? "(null)",
        appOptions.WebSocketPath ?? "(null)",
        appOptions.AcceptClientScreenshots,
        appOptions.ActiveToolbar ?? "(null)",
        activeToolbar);
    app.Logger.LogInformation(
        "Config loaded: Oref.UseMock={UseMock}, Oref.PollIntervalSeconds={PollIntervalSeconds}, Oref.OrefUrl={OrefUrl}",
        orefOptions.UseMock,
        orefOptions.PollIntervalSeconds,
        string.IsNullOrEmpty(orefOptions.OrefUrl) ? "(not set)" : "(set)");
    app.Logger.LogInformation(
        "Config loaded: ConnectionStrings.DefaultDatabase={Db}, Telegram={TelegramStatus}",
        dbSafe,
        telegram.IsConfigured ? "configured" : "not configured");
}

static string MaskConnectionString(string connectionString)
{
    try
    {
        var builder = new System.Data.Common.DbConnectionStringBuilder { ConnectionString = connectionString };
        if (builder.TryGetValue("Host", out var host) && builder.TryGetValue("Database", out var db))
            return $"{host}/{db}";
    }
    catch { /* ignore */ }
    return "(set)";
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
app.UseRateLimiter();

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

    /// <summary>Config value for toolbar: "true" to show, anything else (including "") = false. String so empty env doesn't break binding.</summary>
    public string? ActiveToolbar { get; set; }
}
