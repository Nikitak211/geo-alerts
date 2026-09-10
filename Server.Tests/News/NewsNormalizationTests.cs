using System.Text.Json;
using Server.Services.News;
using Xunit;

namespace Server.Tests.News;

public class NewsNormalizationTests
{
    [Fact]
    public void WorldBounds_AcceptsGlobalPoints()
    {
        Assert.True(WorldBounds.Contains(35.2, 31.8));
        Assert.True(WorldBounds.Contains(-74.0, 40.7));
        Assert.True(WorldBounds.Contains(139.7, 35.7));
        Assert.False(WorldBounds.Contains(200, 0));
    }

    [Theory]
    [InlineData("Missile strike hits city", NewsType.Conflict)]
    [InlineData("Ceasefire talks resume", NewsType.Diplomacy)]
    [InlineData("Refugee aid convoy", NewsType.Humanitarian)]
    [InlineData("Border security raid", NewsType.Security)]
    [InlineData("Weekly cabinet meeting", NewsType.Politics)]
    public void Classifier_MapsKeywords(string title, NewsType expected)
    {
        Assert.Equal(expected, NewsTypeClassifier.Classify(title));
    }

    [Fact]
    public void ParseFeatures_KeepsWorldPoints_AndClassifies()
    {
        var json = """
        {
          "features": [
            {
              "type": "Feature",
              "geometry": { "type": "Point", "coordinates": [35.2, 31.8] },
              "properties": { "name": "Missile attack near Gaza", "count": 3, "url": "https://example.com/a" }
            },
            {
              "type": "Feature",
              "geometry": { "type": "Point", "coordinates": [-74.0, 40.7] },
              "properties": { "name": "New York protest", "count": 1, "url": "https://example.com/b" }
            }
          ]
        }
        """;
        using var doc = JsonDocument.Parse(json);
        var items = GdeltNewsService.ParseFeatures(doc.RootElement);
        Assert.Equal(2, items.Count);
        Assert.Contains(items, i => i.Type == "conflict");
    }

    [Fact]
    public void ParseArtList_GeocodesWorldTitles()
    {
        var json = """
        {
          "articles": [
            {
              "title": "Missile strike near Gaza border",
              "url": "https://example.com/gaza",
              "domain": "example.com",
              "seendate": "20240729T120000Z"
            },
            {
              "title": "Local council meeting in Ohio",
              "url": "https://example.com/ohio",
              "domain": "example.com",
              "seendate": "20240729T120000Z"
            },
            {
              "title": "Vague headline with no place",
              "url": "https://example.com/x",
              "domain": "example.com",
              "seendate": "20240729T120000Z"
            }
          ]
        }
        """;
        using var doc = JsonDocument.Parse(json);
        var items = GdeltNewsService.ParseArtList(doc.RootElement);
        Assert.Equal(2, items.Count);
        Assert.Contains(items, i => i.Type == "conflict");
        Assert.Contains(items, i => i.Title.Contains("Ohio", StringComparison.Ordinal));
    }

    [Fact]
    public void ParseArtList_RejectsNonHttpExternalUrls()
    {
        var json = """
        {
          "articles": [
            {
              "title": "Missile strike near Gaza",
              "url": "javascript:alert(1)",
              "socialimage": "data:image/svg+xml,<svg onload='alert(1)'/>"
            }
          ]
        }
        """;

        using var doc = JsonDocument.Parse(json);
        var item = Assert.Single(GdeltNewsService.ParseArtList(doc.RootElement));

        Assert.StartsWith("https://api.gdeltproject.org/", item.Url);
        Assert.Null(item.ImageUrl);
        Assert.Equal("", NewsItemFactory.ExtractDomain("javascript:alert(1)"));
    }
}
