using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenIddict.Abstractions;
using TempHire.Server.Auth;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace TempHire.Server.Controllers
{
    /// <summary>
    /// Dynamic client registration (RFC 7591): how an MCP client such as Claude Code gets a client id
    /// from TempHire without anyone setting it up by hand.  The authorization server's metadata
    /// advertises this endpoint as <c>registration_endpoint</c> (see Program.cs).
    ///
    /// <para>
    /// OpenIddict 7 has no registration endpoint of its own (it is planned for 8.0), so this one
    /// creates the client through OpenIddict's application manager, which keeps it with the other
    /// clients and hashes any secret.
    /// </para>
    /// <para>
    /// Anyone may register, as the MCP specification intends, so a registration grants nothing by
    /// itself:
    /// </para>
    /// <list type="bullet">
    ///   <item>the client's tokens are for the MCP endpoint only, never for the Breeze API;</item>
    ///   <item>the user must sign in and then consent on a screen that names the client and the
    ///   host its code goes to;</item>
    ///   <item>the user's roles and company apply to the client exactly as to the user;</item>
    ///   <item>redirect URIs must be HTTPS, or HTTP on this machine (where Claude Code and other
    ///   desktop clients listen for the code);</item>
    ///   <item>registrations are rate limited per IP address.</item>
    /// </list>
    /// <para>
    /// The request and response use System.Text.Json, not the Json.NET settings the rest of MVC uses
    /// for Breeze, which would add <c>$id</c> and <c>$type</c> to an RFC-defined document.
    /// </para>
    /// </summary>
    [ApiController]
    [ApiExplorerSettings(IgnoreApi = true)]
    public class ClientRegistrationController : ControllerBase
    {
        public const string RateLimitPolicy = "client-registration";
        public const string Path = "connect/register";

        private static readonly JsonSerializerOptions Json = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

        private static readonly string[] AuthMethods =
            [ClientAuthenticationMethods.None, ClientAuthenticationMethods.ClientSecretPost, ClientAuthenticationMethods.ClientSecretBasic];

        private readonly IOpenIddictApplicationManager _applications;
        private readonly OAuthSettings _settings;

        public ClientRegistrationController(IOpenIddictApplicationManager applications, OAuthSettings settings)
        {
            _applications = applications;
            _settings = settings;
        }

        [HttpPost("~/" + Path)]
        [EnableRateLimiting(RateLimitPolicy)]
        public async Task<IActionResult> Register(CancellationToken cancellationToken)
        {
            RegistrationRequest request;
            try
            {
                request = await JsonSerializer.DeserializeAsync<RegistrationRequest>(Request.Body, Json, cancellationToken);
            }
            catch (JsonException)
            {
                request = null;
            }

            if (request == null)
            {
                return Error("invalid_client_metadata", "The request body must be a JSON client metadata document.");
            }

            if (request.RedirectUris is not { Count: > 0 } || request.RedirectUris.Any(uri => !IsAllowedRedirectUri(uri)))
            {
                return Error("invalid_redirect_uri",
                    "redirect_uris must list one or more absolute URIs, each HTTPS or HTTP on localhost, without a fragment.");
            }

            var authMethod = request.TokenEndpointAuthMethod ?? ClientAuthenticationMethods.None;
            if (!AuthMethods.Contains(authMethod))
            {
                return Error("invalid_client_metadata", $"token_endpoint_auth_method must be one of: {string.Join(", ", AuthMethods)}.");
            }

            var grantTypes = request.GrantTypes is { Count: > 0 } ? request.GrantTypes : [GrantTypes.AuthorizationCode];
            if (!grantTypes.Contains(GrantTypes.AuthorizationCode)
                || grantTypes.Any(g => g != GrantTypes.AuthorizationCode && g != GrantTypes.RefreshToken))
            {
                return Error("invalid_client_metadata", "grant_types must include authorization_code, and may add refresh_token.");
            }

            var responseTypes = request.ResponseTypes is { Count: > 0 } ? request.ResponseTypes : [ResponseTypes.Code];
            if (responseTypes.Any(r => r != ResponseTypes.Code))
            {
                return Error("invalid_client_metadata", "response_types may only be code.");
            }

            var clientName = string.IsNullOrWhiteSpace(request.ClientName) ? "An unnamed MCP client" : request.ClientName.Trim();
            if (clientName.Length > 100)
            {
                clientName = clientName[..100];
            }

            var confidential = authMethod != ClientAuthenticationMethods.None;
            var descriptor = new OpenIddictApplicationDescriptor
            {
                ClientId = Guid.NewGuid().ToString(),
                ClientSecret = confidential ? Base64Url(32) : null,
                ClientType = confidential ? ClientTypes.Confidential : ClientTypes.Public,
                DisplayName = clientName,
                // Not TempHire's own app: the user decides on the consent screen.
                ConsentType = ConsentTypes.Explicit,
                Requirements = { Requirements.Features.ProofKeyForCodeExchange }
            };

            foreach (var uri in request.RedirectUris)
            {
                descriptor.RedirectUris.Add(new Uri(uri));
            }

            descriptor.Permissions.UnionWith(
            [
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,
                Permissions.GrantTypes.AuthorizationCode,
                Permissions.ResponseTypes.Code,
                Permissions.Prefixes.Scope + OAuthSettings.StaffingScope,
                Permissions.Prefixes.Scope + Scopes.OfflineAccess
            ]);
            if (grantTypes.Contains(GrantTypes.RefreshToken))
            {
                descriptor.Permissions.Add(Permissions.GrantTypes.RefreshToken);
            }

            // The MCP endpoint only.
            descriptor.AddResourcePermissions([.. _settings.McpResources]);

            var clientSecret = descriptor.ClientSecret;
            await _applications.CreateAsync(descriptor, cancellationToken);

            var response = new RegistrationResponse
            {
                ClientId = descriptor.ClientId,
                ClientSecret = clientSecret,
                ClientSecretExpiresAt = confidential ? 0 : null,
                ClientIdIssuedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                ClientName = clientName,
                RedirectUris = request.RedirectUris,
                GrantTypes = grantTypes,
                ResponseTypes = responseTypes,
                TokenEndpointAuthMethod = authMethod,
                Scope = $"{OAuthSettings.StaffingScope} {Scopes.OfflineAccess}"
            };

            return new ContentResult
            {
                StatusCode = StatusCodes.Status201Created,
                ContentType = "application/json",
                Content = JsonSerializer.Serialize(response, Json)
            };
        }

        private static bool IsAllowedRedirectUri(string value) =>
            Uri.TryCreate(value, UriKind.Absolute, out var uri)
            && string.IsNullOrEmpty(uri.Fragment)
            && (uri.Scheme == Uri.UriSchemeHttps || (uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback));

        private static string Base64Url(int bytes) =>
            Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(bytes))
                .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        private ContentResult Error(string error, string description) => new()
        {
            StatusCode = StatusCodes.Status400BadRequest,
            ContentType = "application/json",
            Content = JsonSerializer.Serialize(new { error, error_description = description })
        };

        private sealed class RegistrationRequest
        {
            [JsonPropertyName("redirect_uris")] public List<string> RedirectUris { get; set; }
            [JsonPropertyName("client_name")] public string ClientName { get; set; }
            [JsonPropertyName("grant_types")] public List<string> GrantTypes { get; set; }
            [JsonPropertyName("response_types")] public List<string> ResponseTypes { get; set; }
            [JsonPropertyName("token_endpoint_auth_method")] public string TokenEndpointAuthMethod { get; set; }
        }

        private sealed class RegistrationResponse
        {
            [JsonPropertyName("client_id")] public string ClientId { get; set; }
            [JsonPropertyName("client_secret")] public string ClientSecret { get; set; }
            [JsonPropertyName("client_secret_expires_at")] public long? ClientSecretExpiresAt { get; set; }
            [JsonPropertyName("client_id_issued_at")] public long ClientIdIssuedAt { get; set; }
            [JsonPropertyName("client_name")] public string ClientName { get; set; }
            [JsonPropertyName("redirect_uris")] public List<string> RedirectUris { get; set; }
            [JsonPropertyName("grant_types")] public List<string> GrantTypes { get; set; }
            [JsonPropertyName("response_types")] public List<string> ResponseTypes { get; set; }
            [JsonPropertyName("token_endpoint_auth_method")] public string TokenEndpointAuthMethod { get; set; }
            [JsonPropertyName("scope")] public string Scope { get; set; }
        }
    }
}
