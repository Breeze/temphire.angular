using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using OpenIddict.Abstractions;
using TempHire.Model;
using TempHire.Model.Identity;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace TempHire.Server.Auth
{
    /// <summary>
    /// What an access token says about the user: who they are, their company and their roles.
    /// Successor of the old <c>TokenService</c>, which signed these claims into a JWT itself; now
    /// OpenIddict issues the token, and this decides what goes in it.
    ///
    /// <para>
    /// Called when a token is first issued (<c>AuthorizationController.Authorize</c>) and again at
    /// every refresh (<c>Exchange</c>), so the token follows the identity database: a user whose
    /// roles change gets the new ones at the next refresh, and one who is locked out or deleted
    /// gets no new token.
    /// </para>
    /// </summary>
    public class TokenClaims
    {
        private readonly UserManager<TempHireUser> _users;
        private readonly TenantResolver _tenants;

        public TokenClaims(UserManager<TempHireUser> users, TenantResolver tenants)
        {
            _users = users;
            _tenants = tenants;
        }

        /// <summary>
        /// The claims for <paramref name="user"/>, or null when the user may not have a token: locked
        /// out, or not linked to a company.  A user without a company has proved who they are but has
        /// no data to see, so they are refused rather than given a token that only ever returns empty
        /// results.
        /// </summary>
        public async Task<ClaimsIdentity> ForUserAsync(TempHireUser user, CancellationToken cancellationToken = default)
        {
            if (await _users.IsLockedOutAsync(user))
            {
                return null;
            }

            // The tenant, decided from the email domain at every sign-in and refresh (see
            // TenantResolver), and signed into the token, so the client cannot change it.
            var tenant = await _tenants.ForEmailAsync(user.Email ?? user.UserName, cancellationToken);
            if (tenant == null)
            {
                return null;
            }

            var identity = new ClaimsIdentity(
                authenticationType: TokenValidationParameters.DefaultAuthenticationType,
                nameType: Claims.Name,
                roleType: Claims.Role);

            identity
                .SetClaim(Claims.Subject, user.Id.ToString())
                // The name is what the persistence manager stamps into the audit columns.
                .SetClaim(Claims.Name, user.UserName)
                .SetClaim(Claims.Email, user.Email)
                .SetClaim(HttpCurrentTenant.TenantIdClaim, tenant.Id.ToString())
                .SetClaim(HttpCurrentTenant.TenantNameClaim, tenant.Name)
                // The user's Identity roles (Editor, Reader): what [Authorize(Roles)] and IsInRole read.
                .SetClaims(Claims.Role, [.. await _users.GetRolesAsync(user)]);

            // Everything goes into the access token, which the API and the MCP endpoint read.  No
            // identity token is issued: the Angular app asks api/account/me who signed in.
            identity.SetDestinations(_ => [Destinations.AccessToken]);
            return identity;
        }

        /// <summary>A short explanation for a user <see cref="ForUserAsync"/> refuses.</summary>
        public async Task<string> RefusalAsync(TempHireUser user) =>
            await _users.IsLockedOutAsync(user)
                ? "Too many failed attempts. The account is locked for a few minutes; try again later."
                : "Your account is not linked to a company.";
    }
}
