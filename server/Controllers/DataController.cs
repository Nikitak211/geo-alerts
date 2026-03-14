using System.IO;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;

namespace Server.Controllers;

/// <summary>
/// Serves static data files (e.g. municipalities.geojson) from wwwroot/data or content root /data.
/// Ensures /data/municipalities.geojson works when the file exists in the image or a mounted volume.
/// </summary>
[ApiController]
[Route("data")]
public sealed class DataController : ControllerBase
{
    private readonly IWebHostEnvironment _env;
    private static readonly string[] AllowedExtensions = { ".geojson", ".json", ".svg" };

    public DataController(IWebHostEnvironment env)
    {
        _env = env;
    }

    [HttpGet("{fileName}")]
    public IActionResult GetFile(string fileName)
    {
        if (string.IsNullOrEmpty(fileName) || fileName.Contains("..") || Path.IsPathRooted(fileName))
            return NotFound();

        var ext = Path.GetExtension(fileName);
        if (string.IsNullOrEmpty(ext) || !AllowedExtensions.Contains(ext, StringComparer.OrdinalIgnoreCase))
            return NotFound();

        // 1) wwwroot/data (same as static files; controller allows fallback when file is missing from static copy)
        var wwwrootData = Path.Combine(_env.WebRootPath ?? "", "data", fileName);
        if (System.IO.File.Exists(wwwrootData))
            return PhysicalFile(wwwrootData, GetContentType(ext), fileName);

        // 2) Content root /data (e.g. Docker volume at /app/data)
        var contentData = Path.Combine(_env.ContentRootPath ?? "", "data", fileName);
        if (System.IO.File.Exists(contentData))
            return PhysicalFile(contentData, GetContentType(ext), fileName);

        return NotFound();
    }

    private static string GetContentType(string ext)
    {
        return ext.ToLowerInvariant() switch
        {
            ".geojson" or ".json" => "application/json",
            ".svg" => "image/svg+xml",
            _ => "application/octet-stream"
        };
    }
}
