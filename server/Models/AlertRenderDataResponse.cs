namespace Server.Models;

/// <summary>
/// Response for GET /api/alerts/{id}/render-data.
/// Keeps trajectory fields at root for backward compatibility; adds screenshot metadata for future pipeline.
/// </summary>
public sealed class AlertRenderDataResponse
{
    /// <summary>Trajectory polyline [lon, lat][] from impact toward source. Empty when inference not run.</summary>
    public double[][] TrajectoryPolyline { get; init; } = Array.Empty<double[]>();

    /// <summary>Detected or assumed trajectory target: "iran" or "lebanon".</summary>
    public string TrajectoryTarget { get; init; } = "iran";

    /// <summary>Screenshot and reference metadata. Available=false and mode=not_implemented until capture pipeline exists.</summary>
    public ScreenshotMetadata Screenshot { get; init; } = new();
}

/// <summary>
/// Screenshot capture status and optional reference metadata. Not implemented in .NET yet.
/// </summary>
public sealed class ScreenshotMetadata
{
    /// <summary>True only when a screenshot image was captured and is available.</summary>
    public bool Available { get; init; }

    /// <summary>Current mode: e.g. "not_implemented", "captured", "failed".</summary>
    public string Mode { get; init; } = "not_implemented";

    /// <summary>Public URL of the screenshot image when available; null otherwise.</summary>
    public string? ImageUrl { get; init; }

    /// <summary>ISO8601 timestamp when the screenshot was captured; null when not captured.</summary>
    public string? CapturedAt { get; init; }

    /// <summary>Source identifier (e.g. worker name); null when not applicable.</summary>
    public string? Source { get; init; }

    /// <summary>Human-readable note about screenshot status.</summary>
    public string Note { get; init; } = "Screenshot capture pipeline is not yet implemented in .NET.";

    /// <summary>Reference metadata for expected UI layout; does not expose internal paths.</summary>
    public ScreenshotReference Reference { get; init; } = new();
}

/// <summary>
/// Metadata about the reference screenshot used for expected map/popup layout. UI contract only.
/// </summary>
public sealed class ScreenshotReference
{
    /// <summary>True when a reference example exists for implementation target.</summary>
    public bool Available { get; init; } = true;

    /// <summary>Type of reference, e.g. "ui_example".</summary>
    public string Type { get; init; } = "ui_example";

    /// <summary>Short description of the reference.</summary>
    public string Description { get; init; } = "Reference screenshot exists for the expected map popup layout.";

    /// <summary>Field names the reference UI shows (for contract documentation).</summary>
    public string[] FieldsShown { get; init; } = { "location", "time", "lat", "long", "distance" };
}
