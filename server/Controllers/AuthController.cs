using Microsoft.AspNetCore.Mvc;
using Server.DTOs;

namespace Server.Controllers;

[ApiController]
[Route("api")]
public sealed class AuthController : ControllerBase
{
    // NOTE: Implementation will be wired to a proper service and database
    // in the next migration steps. For now this preserves the HTTP surface.

    [HttpPost("register")]
    public ActionResult<AuthResponseDto> Register([FromBody] RegisterRequestDto request)
    {
        // Placeholder implementation to keep the endpoint shape.
        // TODO: replace with real user creation + wallet initialization.
        var user = new AuthResponseDto
        {
            UserId = Guid.NewGuid(),
            Email = request.Email
        };

        return Ok(user);
    }

    [HttpPost("login")]
    public ActionResult<AuthResponseDto> Login([FromBody] LoginRequestDto request)
    {
        // Placeholder implementation to keep the endpoint shape.
        // TODO: validate credentials against stored hash and return existing user id.
        var user = new AuthResponseDto
        {
            UserId = Guid.NewGuid(),
            Email = request.Email
        };

        return Ok(user);
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        // Node implementation is effectively stateless; keep same behavior.
        return NoContent();
    }
}

