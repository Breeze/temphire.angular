using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using TempHire.Model;
using TempHire.Server.Auth;

namespace TempHire.Server.Controllers
{
    /// <summary>
    /// Replaces <c>Security/LoginManager.cs</c> (DevForce's <c>IEntityLoginManager</c>) and
    /// <c>TempHire/Authentication/TempHireAuthenticationService.cs</c>.
    ///
    /// <para>
    /// The lookup itself is unchanged - find the user by a case-insensitive username, then ask the user
    /// entity to verify the password.  What changed is what comes back: DevForce returned an
    /// <c>IPrincipal</c> that it stored in a server session, whereas this returns a JWT for the client
    /// to present on subsequent requests.
    /// </para>
    /// <para>
    /// Multi-tenancy: the user name is an email address, and its domain decides the user's tenant
    /// (<c>anna@harbor.test</c> belongs to Harbor Staffing).  The tenant is looked up here, once, and
    /// its id signed into the token.
    /// </para>
    /// </summary>
    [ApiController]
    [Route("api/account/[action]")]
    public class AccountController : ControllerBase
    {
        private readonly SecurityDbContext _securityContext;
        private readonly TempHireDbContext _context;
        private readonly TokenService _tokenService;

        public AccountController(SecurityDbContext securityContext, TempHireDbContext context, TokenService tokenService)
        {
            _securityContext = securityContext;
            _context = context;
            _tokenService = tokenService;
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<ActionResult<LoginResult>> Login([FromBody] Credential credential)
        {
            // Same guard clauses the DevForce LoginManager threw LoginExceptions for.
            if (credential == null)
            {
                return BadRequest(new ErrorResult { Message = "Credentials are required." });
            }

            if (string.IsNullOrWhiteSpace(credential.Username))
            {
                return BadRequest(new ErrorResult { Message = "Username cannot be empty." });
            }

            if (string.IsNullOrWhiteSpace(credential.Password))
            {
                return BadRequest(new ErrorResult { Message = "Password cannot be empty." });
            }

            var username = credential.Username.Trim();
            var user = await _securityContext.Users
                .FirstOrDefaultAsync(u => u.Username.ToUpper() == username.ToUpper());

            if (user == null || !user.Authenticate(credential.Password))
            {
                // Deliberately vague, and identical for "no such user" and "wrong password".
                return Unauthorized(new ErrorResult { Message = "The username or password is incorrect." });
            }

            // The tenant whose email domain matches the user name's.  A user without one has proved who
            // they are but has no company's data to see, so they are refused here rather than given a
            // token that would only ever return empty results.
            var domain = Tenant.DomainOf(user.Username);
            var tenant = domain == null ? null : await _context.Tenants.SingleOrDefaultAsync(t => t.EmailDomain == domain);
            if (tenant == null)
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    new ErrorResult { Message = "Your account is not linked to a company." });
            }

            var (token, expiresUtc) = _tokenService.CreateToken(user, tenant);

            return new LoginResult
            {
                Username = user.Username,
                TenantName = tenant.Name,
                Token = token,
                ExpiresUtc = expiresUtc
            };
        }

        /// <summary>
        /// Kept for symmetry with the original <c>Logout</c>, which tore down the DevForce session.
        /// With a stateless bearer token there is nothing for the server to forget - the client simply
        /// discards the token - so this exists as the hook you would extend if you added a
        /// revocation list.
        /// </summary>
        [HttpPost]
        [Authorize]
        public IActionResult Logout() => Ok();

        /// <summary>Lets a reloaded client confirm that a stored token is still good.</summary>
        [HttpGet]
        [Authorize]
        public ActionResult<UserInfo> Me() => new UserInfo
        {
            Username = User.Identity?.Name,
            TenantName = User.FindFirst(HttpCurrentTenant.TenantNameClaim)?.Value
        };
    }

    // ----------------------------------------------------------------------------------------------
    // DTOs
    //
    // Every one of these carries [JsonObject(NamingStrategyType = typeof(CamelCaseNamingStrategy))],
    // and that is load-bearing rather than cosmetic.
    //
    // Program.cs hands the whole MVC pipeline to Json.NET via Breeze's
    // JsonSerializationFns.UpdateWithDefaults, which sets ContractResolver.NamingStrategy = null - so
    // by default property names go out verbatim, in PascalCase.  Breeze *needs* that: entity property
    // names on the wire have to match the CLR names in the metadata, and the Angular client converts
    // them itself with NamingConvention.camelCase.
    //
    // The account endpoints are not Breeze endpoints.  The client reads them with a plain HttpClient
    // and nothing converts the names, so a PascalCase "Token" arrives as response.Token while
    // auth.service.ts reads response.token - silently undefined, after which every request goes out
    // as "Bearer undefined" and the app appears to reject a correct password.
    //
    // A per-type naming strategy overrides the resolver's and applies to properties added later, so
    // extending one of these DTOs cannot quietly reintroduce the bug.  (Note that the request path
    // was never affected: Json.NET falls back to a case-insensitive match when binding, so the
    // camelCase login body populated Credential correctly all along.)
    // ----------------------------------------------------------------------------------------------

    /// <summary>Port of DevForce's <c>ILoginCredential</c>.</summary>
    [JsonObject(NamingStrategyType = typeof(CamelCaseNamingStrategy))]
    public class Credential
    {
        public string Username { get; set; }
        public string Password { get; set; }
    }

    [JsonObject(NamingStrategyType = typeof(CamelCaseNamingStrategy))]
    public class LoginResult
    {
        public string Username { get; set; }
        public string TenantName { get; set; }
        public string Token { get; set; }
        public DateTime ExpiresUtc { get; set; }
    }

    [JsonObject(NamingStrategyType = typeof(CamelCaseNamingStrategy))]
    public class UserInfo
    {
        public string Username { get; set; }
        public string TenantName { get; set; }
    }

    /// <summary>Serialises as <c>{ "message": "..." }</c>, which is what the client's
    /// <c>AppErrorHandler.describe</c> looks for.</summary>
    [JsonObject(NamingStrategyType = typeof(CamelCaseNamingStrategy))]
    public class ErrorResult
    {
        public string Message { get; set; }
    }
}
