using System.Net;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Server.Services.News;
using Xunit;

namespace Server.Tests.News;

public class NewsFallbackTests
{
    private const string Rss = """
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title>
        <item><title>Missile strike reported near Gaza</title><link>https://example.com/a</link>
          <description><![CDATA[<p>Details</p>]]></description><pubDate>Mon, 12 Oct 2026 06:00:00 +0000</pubDate>
          <media:content url="https://example.com/a.jpg" /></item>
        <item><title>Cabinet meeting tonight</title><link>https://example.com/b</link><description>No place</description></item>
        <item><title>Bad link</title><link>javascript:alert(1)</link></item>
        </channel></rss>
        """;

    private sealed class Handler(Func<HttpRequestMessage, HttpResponseMessage> f) : HttpMessageHandler
    {
        public int Calls;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct)
        { Calls++; return Task.FromResult(f(r)); }
    }

    private sealed class Factory(HttpMessageHandler h) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(h, disposeHandler: false);
    }

    private sealed class FakeRss(IReadOnlyList<NewsItemDto> items) : IRssNewsSource
    {
        public int Calls;
        public Task<IReadOnlyList<NewsItemDto>> FetchAsync(CancellationToken ct = default) { Calls++; return Task.FromResult(items); }
    }

    [Fact]
    public void Rss_Parse_GeocodesAndSkipsUnsafeLinks()
    {
        var items = RssNewsSource.Parse(new MemoryStream(Encoding.UTF8.GetBytes(Rss.Trim())));
        Assert.Equal(2, items.Count);
        Assert.Equal("conflict", items[0].Type);
        Assert.Equal("https://example.com/a.jpg", items[0].ImageUrl);
        Assert.InRange(items[0].Lat, 31.4, 31.6); // Gaza
        Assert.InRange(items[1].Lat, 31.7, 31.8); // default point (Jerusalem)
    }

    [Fact]
    public async Task Gdelt429_FallsBackToRss_AndPersists_ThenServesDiskCacheAfterRestart()
    {
        var gdelt = new Handler(_ => new HttpResponseMessage(HttpStatusCode.TooManyRequests));
        var path = Path.Combine(Path.GetTempPath(), $"news-{Guid.NewGuid():N}.json");
        var rssItems = RssNewsSource.Parse(new MemoryStream(Encoding.UTF8.GetBytes(Rss.Trim())));
        var rss = new FakeRss(rssItems);
        var svc = new GdeltNewsService(new Factory(gdelt), NullLogger<GdeltNewsService>.Instance,
            new NewsCacheStore(path, NullLogger<NewsCacheStore>.Instance), rss);

        var items = await svc.GetWorldNewsAsync();
        Assert.Equal(2, items.Count);
        Assert.Equal("rss", svc.GetStatus().Source);
        Assert.True(File.Exists(path));

        // A "restarted" service with every upstream failing still serves the persisted list.
        var svc2 = new GdeltNewsService(new Factory(gdelt), NullLogger<GdeltNewsService>.Instance,
            new NewsCacheStore(path, NullLogger<NewsCacheStore>.Instance), new FakeRss([]));
        var again = await svc2.GetWorldNewsAsync();
        Assert.Equal(2, again.Count);
        var st = svc2.GetStatus();
        Assert.True(st.Available);
        Assert.Equal("rss", st.Source);
        File.Delete(path);
    }

    [Fact]
    public async Task Cooldown_SkipsGdelt_AndThrottlesRss_WhenNothingCached()
    {
        var gdelt = new Handler(_ => new HttpResponseMessage(HttpStatusCode.TooManyRequests));
        var rss = new FakeRss([]);
        var now = DateTimeOffset.UtcNow;
        var svc = new GdeltNewsService(new Factory(gdelt), NullLogger<GdeltNewsService>.Instance, null, rss) { Now = () => now };

        await Assert.ThrowsAsync<HttpRequestException>(() => svc.GetWorldNewsAsync());
        await Assert.ThrowsAsync<HttpRequestException>(() => svc.GetWorldNewsAsync());
        Assert.Equal(1, gdelt.Calls); // second call is inside the GDELT cooldown
        Assert.Equal(1, rss.Calls);   // and inside the RSS min interval
        Assert.False(svc.GetStatus().Available);
    }
}
