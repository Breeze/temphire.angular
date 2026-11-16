namespace TempHire.Server.Auth
{
    /// <summary>
    /// The fixed parts of TempHire's OAuth setup: its own client, its scope, and the two resources
    /// a token can be issued for.
    ///
    /// <para>
    /// TempHire's server is its own authorization server (OpenIddict, see Program.cs) and serves two
    /// protected resources, each identified by a URI as RFC 8707 requires:
    /// </para>
    /// <list type="bullet">
    ///   <item><c>{origin}/api</c>: the Breeze, account and agent endpoints the Angular app calls.</item>
    ///   <item><c>{origin}/mcp</c>: the MCP endpoint, for Quinn and for any other MCP client.</item>
    /// </list>
    /// <para>
    /// A token's audience names the resources it may be used at, and each resource accepts only
    /// tokens issued for it (see <see cref="AudienceCheck"/>).  The Angular app's tokens are issued
    /// for both, because Quinn passes the user's token on to the MCP endpoint.  A token an MCP client
    /// such as Claude Code obtains is issued for the MCP endpoint only, so it cannot be used to call
    /// the Breeze API.
    /// </para>
    /// <para>
    /// The origin is the server's own (http://localhost:5000 in development).  A server can answer
    /// on several - the launch profile has https://localhost:5001 as well - so every one is
    /// registered, from <c>OAuth:Origins</c> if set (behind a proxy, set it to the public origin),
    /// otherwise from the URLs the server listens on.
    /// </para>
    /// </summary>
    public class OAuthSettings
    {
        public const string SectionName = "OAuth";

        /// <summary>The Angular app, a public client: it has no secret and proves itself with PKCE.</summary>
        public const string SpaClientId = "temphire-spa";

        /// <summary>Access to the company's staffing data, through the API or the MCP endpoint.</summary>
        public const string StaffingScope = "staffing";

        public const string ApiPath = "/api";
        public const string McpPath = "/mcp";

        /// <summary>Where the authorization server sends the browser back to the Angular app.</summary>
        public const string SpaCallbackPath = "/auth/callback";

        /// <summary>The server's public origins, without a trailing slash.</summary>
        public IReadOnlyList<string> Origins { get; }

        /// <summary>The origins the Angular app is served from: the dev server, and the server itself.</summary>
        public IReadOnlyList<string> SpaOrigins { get; }

        public OAuthSettings(IConfiguration configuration)
        {
            var origins = configuration.GetSection($"{SectionName}:Origins").Get<string[]>();
            if (origins == null || origins.Length == 0)
            {
                origins = (configuration["urls"] ?? "http://localhost:5000")
                    .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            }

            Origins = [.. origins.Select(Normalize).Distinct()];

            var clientOrigins = configuration.GetSection("AllowedClientOrigins").Get<string[]>() ?? [];
            SpaOrigins = [.. clientOrigins.Select(Normalize).Concat(Origins).Distinct()];
        }

        public static string ApiResource(string origin) => origin + ApiPath;

        public static string McpResource(string origin) => origin + McpPath;

        /// <summary>Every resource on every origin: what the authorization server accepts in <c>resource</c>.</summary>
        public IEnumerable<string> AllResources => Origins.SelectMany(o => new[] { ApiResource(o), McpResource(o) });

        public IEnumerable<string> McpResources => Origins.Select(McpResource);

        /// <summary>The origin a request came in on, as the token audience names it.</summary>
        public static string OriginOf(HttpRequest request) => Normalize($"{request.Scheme}://{request.Host}");

        private static string Normalize(string origin) => origin.Trim().TrimEnd('/').ToLowerInvariant();
    }
}
