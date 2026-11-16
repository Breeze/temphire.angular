using System.Security.Claims;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace TempHire.Server.Auth
{
    /// <summary>
    /// Lets each resource accept only the tokens issued for it: a request to <c>/mcp</c> needs a
    /// token whose audience names this server's MCP endpoint, a request to <c>/api</c> one that
    /// names its API.  See <see cref="OAuthSettings"/> for the two resources.
    ///
    /// <para>
    /// The MCP specification requires this ("MCP servers MUST only accept tokens specifically
    /// intended for themselves"), and it is what keeps a token handed to an MCP client from being
    /// used against the Breeze API.  OpenIddict's validation checks one list of audiences for the
    /// whole application, so the per-endpoint check is done here, between authentication and
    /// authorization.  A token for the wrong resource is treated like no token at all: the request
    /// carries on anonymously, and the endpoint's authorization answers 401.
    /// </para>
    /// </summary>
    public class AudienceCheck
    {
        private readonly RequestDelegate _next;

        public AudienceCheck(RequestDelegate next)
        {
            _next = next;
        }

        public Task InvokeAsync(HttpContext context)
        {
            if (context.User.Identity?.IsAuthenticated == true && RequiredAudience(context.Request) is { } audience
                && !context.User.HasClaim(Claims.Audience, audience))
            {
                context.User = new ClaimsPrincipal(new ClaimsIdentity());
            }

            return _next(context);
        }

        private static string RequiredAudience(HttpRequest request)
        {
            var origin = OAuthSettings.OriginOf(request);
            if (request.Path.StartsWithSegments(OAuthSettings.McpPath))
            {
                return OAuthSettings.McpResource(origin);
            }

            return request.Path.StartsWithSegments(OAuthSettings.ApiPath) ? OAuthSettings.ApiResource(origin) : null;
        }
    }
}
