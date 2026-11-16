using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace TempHire.Server.Auth
{
    /// <summary>
    /// The OAuth clients TempHire knows: its own Angular app, registered here at startup, and the
    /// MCP clients that register themselves (<c>ClientRegistrationController</c>).
    /// </summary>
    public static class OAuthClients
    {
        /// <summary>
        /// Registers the Angular app, or brings its registration up to date with the configuration
        /// (its redirect URIs follow <c>AllowedClientOrigins</c> and the server's origins).
        /// </summary>
        public static async Task RegisterSpaAsync(IServiceProvider services, CancellationToken cancellationToken = default)
        {
            var manager = services.GetRequiredService<IOpenIddictApplicationManager>();
            var settings = services.GetRequiredService<OAuthSettings>();

            var descriptor = new OpenIddictApplicationDescriptor
            {
                ClientId = OAuthSettings.SpaClientId,
                DisplayName = "TempHire",
                // No secret: a browser app cannot keep one.  PKCE proves that the app redeeming a code
                // is the one that asked for it.
                ClientType = ClientTypes.Public,
                // TempHire's own app: signing in is consent enough, so no consent screen.
                ConsentType = ConsentTypes.Implicit,
                Requirements = { Requirements.Features.ProofKeyForCodeExchange }
            };

            foreach (var origin in settings.SpaOrigins)
            {
                descriptor.RedirectUris.Add(new Uri(origin + OAuthSettings.SpaCallbackPath));
                descriptor.PostLogoutRedirectUris.Add(new Uri(origin + "/"));
            }

            descriptor.Permissions.UnionWith(
            [
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,
                Permissions.Endpoints.EndSession,
                Permissions.GrantTypes.AuthorizationCode,
                Permissions.GrantTypes.RefreshToken,
                Permissions.ResponseTypes.Code,
                Permissions.Prefixes.Scope + OAuthSettings.StaffingScope,
                Permissions.Prefixes.Scope + Scopes.OfflineAccess
            ]);

            // The app's tokens are good at the API and at the MCP endpoint, which Quinn calls with them.
            descriptor.AddResourcePermissions([.. settings.AllResources]);

            var existing = await manager.FindByClientIdAsync(OAuthSettings.SpaClientId, cancellationToken);
            if (existing == null)
            {
                await manager.CreateAsync(descriptor, cancellationToken);
            }
            else
            {
                await manager.UpdateAsync(existing, descriptor, cancellationToken);
            }
        }
    }
}
