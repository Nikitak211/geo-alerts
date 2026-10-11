using System.Net;

namespace Server.Middleware;

/// <summary>
/// Resolves the real client IP for rate limiting.
/// geo-alerts is served through a Cloudflare Tunnel, so every request reaches Kestrel from the
/// cloudflared connector (loopback / private Docker or LAN address). Cloudflare sets
/// CF-Connecting-IP at its edge (clients cannot override it there). We only trust that header
/// (or the first X-Forwarded-For hop) when the direct peer is loopback/private, i.e. the tunnel;
/// direct requests from public addresses always use the socket address.
/// </summary>
public static class ClientIpResolver
{
    public static string Resolve(HttpContext context)
    {
        var remote = context.Connection.RemoteIpAddress;
        if (remote is not null && IsTrustedProxy(remote))
        {
            if (TryParse(context.Request.Headers["CF-Connecting-IP"].ToString(), out var cf))
                return cf;
            var xff = context.Request.Headers["X-Forwarded-For"].ToString();
            if (!string.IsNullOrEmpty(xff) && TryParse(xff.Split(',')[0], out var fwd))
                return fwd;
        }
        return remote?.ToString() ?? "unknown";
    }

    private static bool TryParse(string? value, out string ip)
    {
        ip = "";
        if (string.IsNullOrWhiteSpace(value) || !IPAddress.TryParse(value.Trim(), out var parsed)) return false;
        ip = parsed.ToString();
        return true;
    }

    public static bool IsTrustedProxy(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        if (IPAddress.IsLoopback(ip)) return true;
        if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
            return ip.IsIPv6UniqueLocal || ip.IsIPv6LinkLocal;
        var b = ip.GetAddressBytes();
        return b[0] == 10
            || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
            || (b[0] == 192 && b[1] == 168);
    }
}
