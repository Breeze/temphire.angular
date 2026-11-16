using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TempHire.Model.Identity;
using TempHire.Model.SampleData;
using TempHire.Server.Auth;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace TempHire.Server.Controllers
{
    /// <summary>
    /// TempHire's sign-in page: where every client - the Angular app, Claude Code, any MCP client -
    /// sends the user to enter their password.  Port of the Angular login page, and before it of
    /// <c>LoginViewModel</c>, now served by the authorization server, because with OAuth the client
    /// never sees the password.
    ///
    /// <para>
    /// A successful sign-in sets a cookie for this server only and returns to the authorization
    /// endpoint, which issues the client its code.  The cookie is what lets the user sign in once
    /// and then authorize the Angular app and an MCP client without typing the password again.
    /// </para>
    /// </summary>
    [Route("account")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public class SignInController : Controller
    {
        private const string BadCredentials = "The email address or password is incorrect.";

        private readonly UserManager<TempHireUser> _users;
        private readonly SignInManager<TempHireUser> _signIn;
        private readonly TokenClaims _claims;
        private readonly TenantResolver _tenants;
        private readonly IWebHostEnvironment _environment;

        public SignInController(
            UserManager<TempHireUser> users,
            SignInManager<TempHireUser> signIn,
            TokenClaims claims,
            TenantResolver tenants,
            IWebHostEnvironment environment)
        {
            _users = users;
            _signIn = signIn;
            _claims = claims;
            _tenants = tenants;
            _environment = environment;
        }

        [HttpGet("login")]
        public async Task<IActionResult> Login(string returnUrl) =>
            View(await WithSampleUsersAsync(new SignInModel { ReturnUrl = returnUrl }));

        [HttpPost("login")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(SignInModel model)
        {
            // A sample user clicked: development only, as the one-click sign-ins always were.  The
            // password is filled in here, so the page never contains it.
            if (!string.IsNullOrEmpty(model.SampleUser) && _environment.IsDevelopment())
            {
                model.UserName = model.SampleUser;
                model.Password = SampleDataProvider.Password;
            }

            model.Error = await SignInAsync(model.UserName?.Trim(), model.Password);
            if (model.Error != null)
            {
                model.Password = null;
                return View(await WithSampleUsersAsync(model));
            }

            // Only ever back to this server (the authorization endpoint), never to an address a link
            // made up.
            return Url.IsLocalUrl(model.ReturnUrl) ? LocalRedirect(model.ReturnUrl) : LocalRedirect("~/");
        }

        /// <summary>Checks the credentials and sets the sign-in cookie; returns why not, or null.</summary>
        private async Task<string> SignInAsync(string userName, string password)
        {
            if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrEmpty(password))
            {
                return "Enter your email address and password.";
            }

            // Identity normalizes the name, so the lookup ignores case.
            var user = await _users.FindByNameAsync(userName);
            if (user == null)
            {
                // Deliberately vague, and identical for "no such user" and "wrong password".
                return BadCredentials;
            }

            // Checks the password and counts a failure towards the lockout.
            var result = await _signIn.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);
            if (result.IsLockedOut)
            {
                return "Too many failed attempts. The account is locked for a few minutes; try again later.";
            }

            if (!result.Succeeded)
            {
                return BadCredentials;
            }

            // Refused here rather than at the client: a user who may not have a token (no company)
            // learns it on this page.
            if (await _claims.ForUserAsync(user, HttpContext.RequestAborted) == null)
            {
                return await _claims.RefusalAsync(user);
            }

            // The cookie says who signed in, nothing more; roles and company are read from the
            // identity database whenever a token is issued.
            var identity = new ClaimsIdentity(CookieAuthenticationDefaults.AuthenticationScheme, Claims.Name, Claims.Role);
            identity.AddClaim(new Claim(Claims.Subject, user.Id.ToString()));
            identity.AddClaim(new Claim(Claims.Name, user.UserName!));
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));
            return null;
        }

        /// <summary>The seeded users, offered as one-click sign-ins in development only.</summary>
        private async Task<SignInModel> WithSampleUsersAsync(SignInModel model)
        {
            if (!_environment.IsDevelopment())
            {
                return model;
            }

            foreach (var (userName, role) in SampleDataProvider.Users)
            {
                var tenant = await _tenants.ForEmailAsync(userName, HttpContext.RequestAborted);
                model.SampleUsers.Add(new SampleUser(userName, role, tenant?.Name ?? ""));
            }

            return model;
        }
    }

    public class SignInModel
    {
        public string UserName { get; set; }
        public string Password { get; set; }
        public string ReturnUrl { get; set; }

        /// <summary>Set by a sample user's button, in development.</summary>
        public string SampleUser { get; set; }

        public string Error { get; set; }
        public List<SampleUser> SampleUsers { get; } = [];
    }

    public record SampleUser(string UserName, string Role, string CompanyName);
}
