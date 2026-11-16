using System.Security.Claims;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using TempHire.Model.Identity;
using TempHire.Server.Auth;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace TempHire.Server.Controllers
{
    /// <summary>
    /// The authorization server's own endpoints: where a client sends the user to sign in
    /// (<c>connect/authorize</c>), where it redeems the code for tokens (<c>connect/token</c>), and
    /// where the user signs out (<c>connect/logout</c>).
    ///
    /// <para>
    /// OpenIddict does the protocol work - it validates each request against the client's
    /// registration, checks PKCE, and issues and validates the codes and tokens - and passes the
    /// request on to these actions to decide the one thing it cannot: who the user is and what goes
    /// in their token.  The user signs in on TempHire's sign-in page (<see cref="SignInController"/>),
    /// which sets a cookie for this server only; the clients never see the password, and never see
    /// the cookie either.
    /// </para>
    /// </summary>
    [ApiExplorerSettings(IgnoreApi = true)]
    public class AuthorizationController : Controller
    {
        private readonly IOpenIddictApplicationManager _applications;
        private readonly IOpenIddictAuthorizationManager _authorizations;
        private readonly UserManager<TempHireUser> _users;
        private readonly TokenClaims _claims;
        private readonly IAntiforgery _antiforgery;

        public AuthorizationController(
            IOpenIddictApplicationManager applications,
            IOpenIddictAuthorizationManager authorizations,
            UserManager<TempHireUser> users,
            TokenClaims claims,
            IAntiforgery antiforgery)
        {
            _applications = applications;
            _authorizations = authorizations;
            _users = users;
            _claims = claims;
            _antiforgery = antiforgery;
        }

        /// <summary>
        /// The authorization endpoint (Authorization Code flow with PKCE).  Signs the user in if they
        /// aren't yet, asks for consent where the client needs it, and then lets OpenIddict send the
        /// browser back to the client with a code.
        /// </summary>
        [HttpGet("~/connect/authorize")]
        [HttpPost("~/connect/authorize")]
        [IgnoreAntiforgeryToken]
        public async Task<IActionResult> Authorize()
        {
            var request = HttpContext.GetOpenIddictServerRequest()
                          ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

            // Signed in on this server?  If not, off to the sign-in page, which comes back here.
            var signIn = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            var user = signIn.Succeeded ? await _users.FindByIdAsync(signIn.Principal.GetClaim(Claims.Subject) ?? "") : null;
            if (user == null)
            {
                if (request.HasPromptValue(PromptValues.None))
                {
                    return Refuse(Errors.LoginRequired, "The user is not signed in.");
                }

                return Challenge(
                    new AuthenticationProperties { RedirectUri = Request.PathBase + Request.Path + QueryString.Create(RequestParameters()) },
                    CookieAuthenticationDefaults.AuthenticationScheme);
            }

            var identity = await _claims.ForUserAsync(user, HttpContext.RequestAborted);
            if (identity == null)
            {
                return Refuse(Errors.AccessDenied, await _claims.RefusalAsync(user));
            }

            var application = await _applications.FindByClientIdAsync(request.ClientId!, HttpContext.RequestAborted)
                              ?? throw new InvalidOperationException("The client application cannot be found.");
            var applicationId = await _applications.GetIdAsync(application, HttpContext.RequestAborted);

            // The consent screen's buttons post back here, with the original request.
            var answer = ConsentAnswer();
            if (answer != null)
            {
                await _antiforgery.ValidateRequestAsync(HttpContext);
                if (answer == "deny")
                {
                    return Refuse(Errors.AccessDenied, "The user did not give the application access.");
                }
            }

            // Consent the user gave this client before, for these scopes, and has not withdrawn.
            var authorizations = await _authorizations.FindAsync(
                subject: user.Id.ToString(),
                client: applicationId,
                status: Statuses.Valid,
                type: AuthorizationTypes.Permanent,
                scopes: request.GetScopes(),
                cancellationToken: HttpContext.RequestAborted).ToListAsync();

            var consentType = await _applications.GetConsentTypeAsync(application, HttpContext.RequestAborted);
            if (consentType == ConsentTypes.Explicit && authorizations.Count == 0 && answer != "accept")
            {
                if (request.HasPromptValue(PromptValues.None))
                {
                    return Refuse(Errors.ConsentRequired, "The user has not given the application access yet.");
                }

                return View("Consent", new ConsentModel
                {
                    ApplicationName = await _applications.GetLocalizedDisplayNameAsync(application, HttpContext.RequestAborted)
                                      ?? request.ClientId,
                    RedirectHost = Uri.TryCreate(request.RedirectUri, UriKind.Absolute, out var redirect) ? redirect.Authority : "",
                    UserName = user.UserName,
                    CompanyName = identity.GetClaim(HttpCurrentTenant.TenantNameClaim),
                    Parameters = RequestParameters()
                });
            }

            identity.SetScopes(request.GetScopes());
            identity.SetResources(Resources(request, request.ClientId));

            // Remember the consent (for the Angular app, the sign-in itself), so the user is asked
            // only once per client, and so a refresh token can be revoked with it.
            var authorization = authorizations.LastOrDefault()
                                ?? await _authorizations.CreateAsync(
                                    identity: identity,
                                    subject: user.Id.ToString(),
                                    client: applicationId!,
                                    type: AuthorizationTypes.Permanent,
                                    scopes: identity.GetScopes(),
                                    cancellationToken: HttpContext.RequestAborted);
            identity.SetAuthorizationId(await _authorizations.GetIdAsync(authorization, HttpContext.RequestAborted));

            return SignIn(new ClaimsPrincipal(identity), OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        }

        /// <summary>
        /// The token endpoint: a code for tokens, or a refresh token for new ones.  OpenIddict has
        /// already checked the code or refresh token (and the PKCE verifier); the user's claims are
        /// read again here, so the new token has their current roles and company.
        /// </summary>
        [HttpPost("~/connect/token")]
        [IgnoreAntiforgeryToken]
        [Produces("application/json")]
        public async Task<IActionResult> Exchange()
        {
            var request = HttpContext.GetOpenIddictServerRequest()
                          ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

            if (!request.IsAuthorizationCodeGrantType() && !request.IsRefreshTokenGrantType())
            {
                throw new InvalidOperationException("The specified grant type is not supported.");
            }

            var result = await HttpContext.AuthenticateAsync(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
            var user = await _users.FindByIdAsync(result.Principal?.GetClaim(Claims.Subject) ?? "");
            if (user == null)
            {
                return Refuse(Errors.InvalidGrant, "The user no longer exists.");
            }

            var identity = await _claims.ForUserAsync(user, HttpContext.RequestAborted);
            if (identity == null)
            {
                return Refuse(Errors.InvalidGrant, await _claims.RefusalAsync(user));
            }

            identity.SetScopes(result.Principal!.GetScopes())
                .SetResources(result.Principal.GetResources())
                .SetAuthorizationId(result.Principal.GetAuthorizationId());

            return SignIn(new ClaimsPrincipal(identity), OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        }

        /// <summary>
        /// The end-session endpoint: signs the user out of this server, then OpenIddict sends the
        /// browser back to the client's registered post-logout address.
        /// </summary>
        [HttpGet("~/connect/logout")]
        [HttpPost("~/connect/logout")]
        [IgnoreAntiforgeryToken]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return SignOut(new AuthenticationProperties { RedirectUri = "/" }, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        }

        /// <summary>
        /// The resources the token is for.  A client that names them (an MCP client must, with
        /// RFC 8707's <c>resource</c> parameter) gets those - OpenIddict has already checked that
        /// the client may have them.  Otherwise: the API and the MCP endpoint for TempHire's own app,
        /// the MCP endpoint alone for any other client.
        /// </summary>
        private IEnumerable<string> Resources(OpenIddictRequest request, string clientId)
        {
            var requested = request.GetResources();
            if (requested.Length > 0)
            {
                return requested;
            }

            var origin = OAuthSettings.OriginOf(Request);
            return clientId == OAuthSettings.SpaClientId
                ? [OAuthSettings.ApiResource(origin), OAuthSettings.McpResource(origin)]
                : [OAuthSettings.McpResource(origin)];
        }

        /// <summary>"accept" or "deny" when the consent screen posted back, otherwise null.</summary>
        private string ConsentAnswer()
        {
            if (!Request.HasFormContentType)
            {
                return null;
            }

            return Request.Form.ContainsKey("submit.accept") ? "accept"
                : Request.Form.ContainsKey("submit.deny") ? "deny"
                : null;
        }

        /// <summary>The authorization request's own parameters, to send it round again.</summary>
        private List<KeyValuePair<string, string>> RequestParameters()
        {
            var source = Request.HasFormContentType ? Request.Form.AsEnumerable() : Request.Query.AsEnumerable();
            return
            [
                .. source
                    .Where(p => !p.Key.StartsWith("submit.") && p.Key != "__RequestVerificationToken")
                    .SelectMany(p => p.Value.Select(v => new KeyValuePair<string, string>(p.Key, v ?? "")))
            ];
        }

        /// <summary>Ends the request with an OAuth error, which OpenIddict returns to the client.</summary>
        private ForbidResult Refuse(string error, string description) => Forbid(
            new AuthenticationProperties(new Dictionary<string, string>
            {
                [OpenIddictServerAspNetCoreConstants.Properties.Error] = error,
                [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] = description
            }),
            OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    /// <summary>What the consent screen shows, and the request it posts back.</summary>
    public class ConsentModel
    {
        public string ApplicationName { get; set; }

        /// <summary>
        /// Where the code will go.  The MCP specification asks the authorization server to show it,
        /// because a client's name alone proves nothing: anyone can register as "Claude Code".
        /// </summary>
        public string RedirectHost { get; set; }

        public string UserName { get; set; }
        public string CompanyName { get; set; }
        public List<KeyValuePair<string, string>> Parameters { get; set; } = [];
    }
}
