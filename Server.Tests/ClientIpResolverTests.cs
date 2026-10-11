using System.Net;
using Microsoft.AspNetCore.Http;
using Server.Middleware;
using Xunit;

namespace Server.Tests;

public class ClientIpResolverTests
{
    private static HttpContext Ctx(string remote, string? cf = null, string? xff = null)
    {
        var c = new DefaultHttpContext();
        c.Connection.RemoteIpAddress = IPAddress.Parse(remote);
        if (cf != null) c.Request.Headers["CF-Connecting-IP"] = cf;
        if (xff != null) c.Request.Headers["X-Forwarded-For"] = xff;
        return c;
    }

    [Fact] public void TunnelPeer_UsesCfConnectingIp() =>
        Assert.Equal("203.0.113.7", ClientIpResolver.Resolve(Ctx("172.18.0.1", cf: "203.0.113.7")));

    [Fact] public void TunnelPeer_FallsBackToFirstXff() =>
        Assert.Equal("198.51.100.2", ClientIpResolver.Resolve(Ctx("127.0.0.1", xff: "198.51.100.2, 10.0.0.1")));

    [Fact] public void PublicPeer_IgnoresSpoofedHeader() =>
        Assert.Equal("8.8.8.8", ClientIpResolver.Resolve(Ctx("8.8.8.8", cf: "1.2.3.4")));

    [Fact] public void GarbageHeader_IsIgnored() =>
        Assert.Equal("10.0.0.5", ClientIpResolver.Resolve(Ctx("10.0.0.5", cf: "not-an-ip")));
}
