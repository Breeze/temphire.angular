using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TempHire.Model;
using TempHire.Model.Identity;

namespace TempHire.Server.Auth
{
    /// <summary>
    /// Issues the bearer token that replaces the DevForce login session.
    ///
    /// <para>
    /// DevForce authenticated through <c>IEntityLoginManager</c> (see <c>Security/LoginManager.cs</c>)
    /// and then kept a server-side session keyed by a login token that the client's EntityManager
    /// carried on every request.  A Breeze client is just an HTTP client, so the equivalent is a
    /// stateless JWT presented in the <c>Authorization</c> header by an Angular interceptor.
    /// </para>
    /// <para>
    /// The token is issued for an Identity user and a tenant, however the user proved who they are.
    /// A password sign-in (<c>AccountController.Login</c>) and, once one is added, a sign-in through an
    /// external provider such as Microsoft Entra ID both end here, so the API, Breeze and the MCP
    /// endpoint see the same token whichever way the user signed in.
    /// </para>
    /// </summary>
    public class TokenService
    {
        private readonly JwtOptions _options;

        public TokenService(IOptions<JwtOptions> options)
        {
            _options = options.Value;
        }

        public static SymmetricSecurityKey CreateSigningKey(string key)
        {
            return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        }

        public (string Token, DateTime ExpiresUtc) CreateToken(TempHireUser user, IEnumerable<string> roles, Tenant tenant)
        {
            var expires = DateTime.UtcNow.AddMinutes(_options.ExpiryMinutes);

            var claims = new List<Claim>
            {
                // ClaimTypes.Name is what UserPrincipal.Identity.Name resolved to in the original, and
                // it is what the persistence manager stamps into the audit columns.
                new Claim(ClaimTypes.Name, user.UserName),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                // The tenant, decided at sign-in from the email domain (see TenantResolver).
                // Signed into the token, so the client cannot change it.
                new Claim(HttpCurrentTenant.TenantIdClaim, tenant.Id.ToString()),
                new Claim(HttpCurrentTenant.TenantNameClaim, tenant.Name),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            // The user's Identity roles (Editor, Reader).  ClaimTypes.Role is what [Authorize(Roles)]
            // and ClaimsPrincipal.IsInRole read.  A role changed in the identity database takes effect
            // at the next sign-in, when a new token is issued.
            claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

            var credentials = new SigningCredentials(
                CreateSigningKey(_options.SigningKey), SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _options.Issuer,
                audience: _options.Audience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: expires,
                signingCredentials: credentials);

            return (new JwtSecurityTokenHandler().WriteToken(token), expires);
        }
    }
}
