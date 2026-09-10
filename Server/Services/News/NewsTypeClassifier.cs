namespace Server.Services.News;

public enum NewsType
{
    Conflict,
    Diplomacy,
    Security,
    Humanitarian,
    Politics
}

public static class NewsTypeClassifier
{
    private static readonly (NewsType Type, string[] Keywords)[] Rules =
    [
        (NewsType.Conflict, ["missile", "strike", "attack", "bomb", "rocket", "war", "shell", "explosion", "killed", "airstrike", "combat", "invade", "invasion", "offensive"]),
        (NewsType.Diplomacy, ["ceasefire", "talks", "diplomat", "negotiation", "treaty", "summit", "envoy", "peace", "accord", "mediation", "ambassador"]),
        (NewsType.Security, ["security", "terror", "intel", "intercept", "defense", "defence", "border", "checkpoint", "arrest", "raid", "militia"]),
        (NewsType.Humanitarian, ["aid", "refugee", "humanitarian", "hospital", "civilian", "evacuate", "evacuation", "relief", "displaced", "famine", "unrwa"]),
    ];

    public static NewsType Classify(string? title)
    {
        if (string.IsNullOrWhiteSpace(title))
            return NewsType.Politics;

        var lower = title.ToLowerInvariant();
        foreach (var (type, keywords) in Rules)
        {
            foreach (var kw in keywords)
            {
                if (lower.Contains(kw, StringComparison.Ordinal))
                    return type;
            }
        }

        return NewsType.Politics;
    }

    public static string ToApiString(NewsType type) => type switch
    {
        NewsType.Conflict => "conflict",
        NewsType.Diplomacy => "diplomacy",
        NewsType.Security => "security",
        NewsType.Humanitarian => "humanitarian",
        _ => "politics",
    };
}
