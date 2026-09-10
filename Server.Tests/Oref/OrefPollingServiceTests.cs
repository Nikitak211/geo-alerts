using Server.Services;
using Xunit;

namespace Server.Tests.Oref;

public class OrefPollingServiceTests
{
    [Theory]
    [InlineData("\0\0\0\0\0")]
    [InlineData(" \r\n\t")]
    [InlineData("\uFEFF[]")]
    public void ParseLivePayload_TreatsEmptyRepresentationsAsNoAlert(string payload)
    {
        Assert.Null(OrefPollingService.ParseLivePayload(payload));
    }

    [Fact]
    public void ParseLivePayload_ParsesAlertObjectAfterNullPrefix()
    {
        var payload = "\0\uFEFF{\"id\":\"123\",\"data\":[\"Area\"]}";

        var parsed = OrefPollingService.ParseLivePayload(payload);

        Assert.NotNull(parsed);
        Assert.Equal("123", parsed.Value.GetProperty("id").GetString());
    }
}
