using Breeze.AspNetCore;
using Breeze.Core;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ModelContextProtocol.AspNetCore.Authentication;
using ModelContextProtocol.Authentication;
using OpenIddict.Abstractions;
using OpenIddict.Server;
using OpenIddict.Validation.AspNetCore;
using System.Net;
using System.Security.Claims;
using System.Threading.RateLimiting;
using TempHire.Server.Controllers;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;
using TempHire.Model;
using TempHire.Model.Identity;
using TempHire.Server.Agent;
using TempHire.Server.Auth;
using TempHire.Server.Mcp;
using TempHire.Server.Persistence;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------------------------
// MVC + Breeze serialization
//
// Breeze speaks Json.NET, not System.Text.Json: it relies on $id / $ref reference handling and on
// $type to identify entities inside a payload.  JsonSerializationFns.UpdateWithDefaults applies the
// settings Breeze needs.  Property names are left in PascalCase on the wire and converted by the
// client's NamingConvention.camelCase - this is exactly how the Breeze samples are wired.
// ---------------------------------------------------------------------------------------------
// With views: the authorization server's sign-in and consent pages (Views/) are MVC views.
builder.Services.AddControllersWithViews()
    .AddNewtonsoftJson(opt =>
    {
        var ss = JsonSerializationFns.UpdateWithDefaults(opt.SerializerSettings);
        if (ss.ContractResolver is DefaultContractResolver resolver)
        {
            resolver.NamingStrategy = null;
        }
    })
    // Turns server-side exceptions - including the EntityErrorsException our persistence manager
    // throws for validation failures - into the error shape the Breeze client understands.  A save
    // the user may not make answers 403: one by a user who is not an editor, or one that touches
    // another tenant's row (TenantAccessException).  Both are UnauthorizedAccessExceptions.
    .AddMvcOptions(o => o.Filters.Add(new GlobalExceptionFilter
    {
        StatusCodeForException = e => e.GetBaseException() is UnauthorizedAccessException ? HttpStatusCode.Forbidden : null
    }));

// ---------------------------------------------------------------------------------------------
// Data stores
//
// Two databases, as the original had two SQL Compact files (TempHire.sdf and
// TempHire.Security.sdf): the staffing data, and the users, now kept by ASP.NET Core Identity.
// ---------------------------------------------------------------------------------------------
builder.Services.AddDbContext<TempHireDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("TempHire")));

// The identity database also holds OpenIddict's tables: the registered clients, the users' consents
// and the tokens it has issued.
builder.Services.AddDbContext<TempHireIdentityDbContext>(options => options
    .UseSqlServer(builder.Configuration.GetConnectionString("TempHireIdentity"))
    .UseOpenIddict<Guid>());

// Multi-tenancy: TempHireDbContext asks this for the current tenant, which comes from the
// tenant_id claim in the access token.  See HttpCurrentTenant and TempHireDbContext.
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentTenant, HttpCurrentTenant>();

// ---------------------------------------------------------------------------------------------
// Users - ASP.NET Core Identity
//
// Identity keeps the users and checks their passwords (SignInController); only Identity's core
// services are added, because the sign-in cookie and the tokens are set up below.  A sign-in, by
// password or later through an external provider such as Microsoft Entra ID, ends the same way:
// TokenClaims picks the company and roles that go into the token.
// ---------------------------------------------------------------------------------------------
builder.Services
    .AddIdentityCore<TempHireUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<TempHireIdentityDbContext>()
    .AddSignInManager();

builder.Services.AddScoped<TenantResolver>();
builder.Services.AddScoped<TokenClaims>();

// ---------------------------------------------------------------------------------------------
// OAuth 2.1 - the replacement for the DevForce login session
//
// The server is its own authorization server, built with OpenIddict.  Every client signs the user
// in the same way, with the Authorization Code flow and PKCE: the Angular app, Claude Code, any
// MCP client.  The user enters the password on the server's sign-in page (SignInController), never
// in a client; the client gets an access token and a refresh token.
//
//   connect/authorize   sign in, consent, code     AuthorizationController.Authorize
//   connect/token       code or refresh -> tokens  AuthorizationController.Exchange
//   connect/logout      sign out                   AuthorizationController.Logout
//   connect/register    MCP clients register       ClientRegistrationController
//   .well-known/...     metadata, keys             OpenIddict itself
//
// See OAuthSettings for the two resources (the API, the MCP endpoint) a token can be for.
// ---------------------------------------------------------------------------------------------
var oauth = new OAuthSettings(builder.Configuration);
builder.Services.AddSingleton(oauth);

builder.Services.AddOpenIddict()
    .AddCore(options => options
        .UseEntityFrameworkCore()
        .UseDbContext<TempHireIdentityDbContext>()
        .ReplaceDefaultEntities<Guid>())
    .AddServer(options =>
    {
        options
            .SetAuthorizationEndpointUris("connect/authorize")
            .SetTokenEndpointUris("connect/token")
            .SetEndSessionEndpointUris("connect/logout");

        options
            .AllowAuthorizationCodeFlow()
            .AllowRefreshTokenFlow()
            .RequireProofKeyForCodeExchange();

        // OAuth 2.1 allows only S256; OpenIddict would also accept the "plain" method.
        options.Configure(server => server.CodeChallengeMethods.Remove(OpenIddictConstants.CodeChallengeMethods.Plain));

        options.RegisterScopes(OAuthSettings.StaffingScope, OpenIddictConstants.Scopes.OfflineAccess);

        // RFC 8707: the resources a client may name, and so the audiences a token can have.
        options.RegisterResources([.. oauth.AllResources]);

        // Short-lived access tokens, as the MCP specification asks; the clients renew them with the
        // refresh token, which OpenIddict rotates at each use.
        options.SetAccessTokenLifetime(TimeSpan.FromMinutes(30));

        if (builder.Environment.IsDevelopment())
        {
            // Signing and encryption keys: development certificates, created in the current user's
            // certificate store on first run.  Anywhere real, load proper certificates instead
            // (AddSigningCertificate / AddEncryptionCertificate).
            options
                .AddDevelopmentEncryptionCertificate()
                .AddDevelopmentSigningCertificate();
        }

        // Plain signed JWTs rather than encrypted ones, so a token can be read at jwt.io while
        // learning how this works.  They carry nothing secret: the user's name, company and roles.
        options.DisableAccessTokenEncryption();

        var aspNetCore = options.UseAspNetCore()
            .EnableAuthorizationEndpointPassthrough()
            .EnableTokenEndpointPassthrough()
            .EnableEndSessionEndpointPassthrough();

        if (builder.Environment.IsDevelopment())
        {
            // OAuth requires HTTPS; the development profile also serves plain HTTP on localhost.
            aspNetCore.DisableTransportSecurityRequirement();
        }

        // RFC 7591: tell clients where to register.  OpenIddict 7 has no registration endpoint of
        // its own, so it doesn't advertise one; ClientRegistrationController is TempHire's.
        options.AddEventHandler<OpenIddictServerEvents.HandleConfigurationRequestContext>(handler =>
            handler.UseInlineHandler(context =>
            {
                context.Metadata["registration_endpoint"] = new Uri(context.BaseUri!, ClientRegistrationController.Path).AbsoluteUri;
                return default;
            }));
    })
    .AddValidation(options =>
    {
        // The API and the MCP endpoint check the tokens this same server issues.
        options.UseLocalServer();
        options.UseAspNetCore();
    });

// Three ways in: an access token (every API and MCP request), the sign-in cookie (the authorization
// server's own pages only), and the MCP scheme, which only answers a request without a valid token
// at /mcp, pointing the client at the resource metadata (RFC 9728) so it can find the authorization
// server.  A policy scheme picks between them.
const string DefaultScheme = "TempHire";
builder.Services
    .AddAuthentication(DefaultScheme)
    .AddPolicyScheme(DefaultScheme, "Access token, or MCP discovery", options =>
    {
        options.ForwardAuthenticate = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
        options.ForwardForbid = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
        options.ForwardDefaultSelector = context => context.Request.Path.StartsWithSegments(OAuthSettings.McpPath)
            ? McpAuthenticationDefaults.AuthenticationScheme
            : OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
    })
    .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
    {
        options.LoginPath = "/account/login";
        options.Cookie.Name = "TempHire.SignIn";
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
    })
    .AddMcp(options =>
    {
        // RFC 9728, served at /.well-known/oauth-protected-resource.  Built per request, because
        // the resource is named by the origin the client used.
        options.Events.OnResourceMetadataRequest = context =>
        {
            var origin = OAuthSettings.OriginOf(context.Request);
            context.ResourceMetadata = new ProtectedResourceMetadata
            {
                Resource = OAuthSettings.McpResource(origin),
                ResourceName = "TempHire",
                // Exactly the issuer OpenIddict announces (with the trailing slash), which clients
                // may compare with the one in the authorization server's metadata.
                AuthorizationServers = [origin + "/"],
                ScopesSupported = [OAuthSettings.StaffingScope, OpenIddictConstants.Scopes.OfflineAccess]
            };
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization();

// Dynamic client registration is open to anyone, so it is rate limited per IP address.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(ClientRegistrationController.RateLimitPolicy, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
});

// ---------------------------------------------------------------------------------------------
// MCP server - the staffing data as tools for an AI agent (Quinn, or any MCP client)
//
// Served at /mcp over the streamable HTTP transport, as an OAuth-protected resource: it accepts
// access tokens issued for it (AudienceCheck), and answers a request without one with a 401 that
// points the client at the resource metadata, from where an MCP client such as Claude Code finds
// the authorization server, registers, and signs the user in.  Stateless: each request carries
// everything, including the caller's token, and gets a fresh StaffingTools with that request's
// tenant-filtered TempHireDbContext.
// ---------------------------------------------------------------------------------------------
builder.Services
    .AddMcpServer(options =>
    {
        options.ServerInfo = new() { Name = "TempHire", Version = "1.0.0" };
        options.ServerInstructions =
            "Read-only staffing data of the signed-in user's company: staffing resources with their " +
            "addresses, phone numbers, rates (US dollars), skills and work history.";
    })
    .WithHttpTransport(options => options.Stateless = true)
    // Tool results reach the model as JSON text.  Relaxed escaping keeps them readable ("C++",
    // "Müller") instead of the default +, ü and " escapes, which cost tokens and
    // confuse small local models.
    .WithTools<StaffingTools>(new System.Text.Json.JsonSerializerOptions(ModelContextProtocol.McpJsonUtilities.DefaultOptions)
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    })
    // Roles: the tools read the company's staffing data, so they need the Editor or Reader role, as
    // the Breeze queries do.  A signed-in user with neither may still connect and list the tools -
    // Quinn connects before every answer, and can still answer questions that need no data, such as
    // the one about its name - but every tool call answers that the user has no access.  The model
    // gets that as the tool's result and passes it on, rather than being left to guess.
    .WithRequestFilters(filters => filters.AddCallToolFilter(next => async (context, cancellationToken) =>
        context.User?.IsInRole(TempHireRoles.Editor) == true || context.User?.IsInRole(TempHireRoles.Reader) == true
            ? await next(context, cancellationToken)
            : new ModelContextProtocol.Protocol.CallToolResult
            {
                IsError = true,
                Content =
                [
                    new ModelContextProtocol.Protocol.TextContentBlock
                    {
                        Text = "Access denied: this user's account has no access to the company's staffing data " +
                               "(it needs the Editor or Reader role). Tell the user they don't have access to " +
                               "that data. Do not answer the question from other knowledge."
                    }
                ]
            }));

// ---------------------------------------------------------------------------------------------
// Quinn, the agent - see AgentController.  Ollama or Claude, per the Agent section of appsettings.
// ---------------------------------------------------------------------------------------------
builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection(AgentOptions.SectionName));
builder.Services.AddSingleton<ChatClientFactory>();
builder.Services.AddScoped<QuinnAgent>();
builder.Services.AddHttpClient(nameof(QuinnAgent));

// ---------------------------------------------------------------------------------------------
// CORS - the Angular dev server runs on a different origin (localhost:4200)
// ---------------------------------------------------------------------------------------------
const string DevCorsPolicy = "AngularDevServer";
builder.Services.AddCors(options =>
    options.AddPolicy(DevCorsPolicy, policy => policy
        .WithOrigins(
            builder.Configuration.GetSection("AllowedClientOrigins").Get<string[]>()
            ?? new[] { "http://localhost:4200", "https://localhost:4200" })
        .AllowAnyHeader()
        .AllowAnyMethod()));

var app = builder.Build();

// Breeze 8 no longer puts the server stack trace in error responses by default; keep it in
// development, where it helps, and leave it out everywhere else.
Breeze.Persistence.BreezeConfig.Instance.IncludeStackTraceInErrors = app.Environment.IsDevelopment();

// ---------------------------------------------------------------------------------------------
// Metadata export:  dotnet run -- --export-metadata <file>
//
// Writes the same Breeze metadata the `Metadata` endpoint serves, then exits without starting the
// web server.  The client checks this file in and generates its entity classes from it (see
// `npm run model` in the client), so the generator needs neither a running server nor a login.
// The metadata comes from the EF Core model alone; no database connection is opened.
// ---------------------------------------------------------------------------------------------
var exportIndex = Array.IndexOf(args, "--export-metadata");
if (exportIndex >= 0)
{
    if (exportIndex + 1 >= args.Length)
    {
        throw new ArgumentException("--export-metadata needs a file path.");
    }

    var path = Path.GetFullPath(args[exportIndex + 1]);
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<TempHireDbContext>();
    var metadata = new TempHirePersistenceManager(context, new ClaimsPrincipal()).Metadata();

    // Indented, so that a schema change shows up as a readable diff in review.
    File.WriteAllText(path, JToken.Parse(metadata).ToString(Formatting.Indented) + Environment.NewLine);
    Console.WriteLine($"Breeze metadata written to {path}");
    return;
}

// ---------------------------------------------------------------------------------------------
// Schema migration and seeding, on startup.
//
// Applies any pending EF Core migrations, then seeds empty databases: the replacement for Punch's
// ISampleDataProvider / "fake store", which populated an in-memory DevForce EntityManager.  Migrating
// on startup is a convenience for this sample, not how a production app should do it; see
// DatabaseSetup and the README.
// ---------------------------------------------------------------------------------------------
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<TempHireDbContext>();
    var identityContext = scope.ServiceProvider.GetRequiredService<TempHireIdentityDbContext>();
    DatabaseSetup.Prepare(context, identityContext, app.Logger);

    // The Angular app's client registration, kept in step with the configuration.
    await OAuthClients.RegisterSpaAsync(scope.ServiceProvider);
}

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseRouting();
app.UseCors(DevCorsPolicy);
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<AudienceCheck>();
app.UseAuthorization();

app.MapControllers();

// The MCP endpoint.  RequireAuthorization: no valid access token for the MCP endpoint, no tools (401).
app.MapMcp("/mcp").RequireAuthorization();

// Serve the production Angular build when it has been copied into wwwroot
// (see `npm run build` in the client project).  Harmless when wwwroot is empty.
app.UseDefaultFiles();
app.UseStaticFiles();

// Anything else is the Angular app - except the server's own paths, which answer 404 when nothing
// is there.  OAuth clients probe several metadata addresses in turn (RFC 8414, OpenID Connect,
// RFC 9728) and move on at a 404; handed index.html instead, they would give up.
foreach (var serverPath in new[] { "/.well-known", "/connect", "/api", "/mcp" })
{
    app.Map(serverPath + "/{**rest}", () => Results.NotFound());
}

app.MapFallbackToFile("index.html");

app.Run();
