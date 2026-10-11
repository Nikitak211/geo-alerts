namespace Server.Middleware;

/// <summary>
/// Adds HSTS, CSP and other security headers to every response (API, SPA, static files, SignalR negotiate).
/// CSP allows: Cesium (WASM + blob workers), Leaflet/OSM/Stadia tiles and remote images over https,
/// SignalR over same-origin wss/https, MUI/emotion inline styles.
/// </summary>
public sealed class SecurityHeadersMiddleware
{
    public const string Csp =
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob:;  " +
        "worker-src 'self' blob:; " +
        "child-src 'self' blob:; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' data: https://fonts.gstatic.com; " +
        "img-src 'self' data: blob: https:; " +
        "media-src 'self' blob: https:; " +
        "connect-src 'self' wss: https: blob: data:; " +
        "frame-src 'self'; " +
        "frame-ancestors 'self'; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "upgrade-insecure-requests";

    private readonly RequestDelegate _next;
    private readonly bool _isDevelopment;

    public SecurityHeadersMiddleware(RequestDelegate next, IWebHostEnvironment env)
    {
        _next = next;
        _isDevelopment = env.IsDevelopment();
    }

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var h = context.Response.Headers;
            if (!_isDevelopment)
            {
                // TLS is terminated at Cloudflare; the browser only ever sees HTTPS.
                h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
                h["Content-Security-Policy"] = Csp;
            }
            else
            {
                // Dev: report only (CRA dev server / hot reload use eval + ws://localhost).
                h["Content-Security-Policy-Report-Only"] = Csp;
            }
            h["X-Content-Type-Options"] = "nosniff";
            h["X-Frame-Options"] = "SAMEORIGIN";
            h["Referrer-Policy"] = "strict-origin-when-cross-origin";
            h["Permissions-Policy"] = "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)";
            h["Cross-Origin-Opener-Policy"] = "same-origin";
            h["X-Permitted-Cross-Domain-Policies"] = "none";
            h.Remove("Server");
            h.Remove("X-Powered-By");
            return Task.CompletedTask;
        });
        return _next(context);
    }
}
