using Breeze.AspNetCore;
using Breeze.Core;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Net;
using System.Security.Claims;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;
using TempHire.Model;
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
builder.Services.AddControllers()
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
    // that touches another tenant's row (TenantAccessException) answers 403.
    .AddMvcOptions(o => o.Filters.Add(new GlobalExceptionFilter
    {
        StatusCodeForException = e => e.GetBaseException() is TenantAccessException ? HttpStatusCode.Forbidden : null
    }));

// ---------------------------------------------------------------------------------------------
// Data stores
//
// Two contexts, matching the two SQL Compact files the original shipped with
// (TempHire.sdf and TempHire.Security.sdf).
// ---------------------------------------------------------------------------------------------
builder.Services.AddDbContext<TempHireDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("TempHire")));

builder.Services.AddDbContext<SecurityDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("TempHireSecurity")));

// Multi-tenancy: TempHireDbContext asks this for the current tenant, which comes from the
// tenant_id claim in the access token.  See HttpCurrentTenant and TempHireDbContext.
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentTenant, HttpCurrentTenant>();

// ---------------------------------------------------------------------------------------------
// Authentication - the replacement for the DevForce login session
// ---------------------------------------------------------------------------------------------
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.AddSingleton<TokenService>();

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
if (string.IsNullOrWhiteSpace(jwt.SigningKey))
{
    throw new InvalidOperationException(
        "Jwt:SigningKey is not configured.  Set it in appsettings.Development.json, " +
        "user-secrets, or the Jwt__SigningKey environment variable.");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = TokenService.CreateSigningKey(jwt.SigningKey),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

// ---------------------------------------------------------------------------------------------
// MCP server - the staffing data as tools for an AI agent (Quinn, or any MCP client)
//
// Served at /mcp over the streamable HTTP transport, behind the same JWT authentication as the
// rest of the API.  Stateless: each request carries everything, including the caller's token, and
// gets a fresh StaffingTools with that request's tenant-filtered TempHireDbContext.
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
    });

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
    var securityContext = scope.ServiceProvider.GetRequiredService<SecurityDbContext>();
    DatabaseSetup.Prepare(context, securityContext, app.Logger);
}

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseRouting();
app.UseCors(DevCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// The MCP endpoint.  RequireAuthorization: no valid access token, no tools (401).
app.MapMcp("/mcp").RequireAuthorization();

// Serve the production Angular build when it has been copied into wwwroot
// (see `npm run build` in the client project).  Harmless when wwwroot is empty.
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapFallbackToFile("index.html");

app.Run();
