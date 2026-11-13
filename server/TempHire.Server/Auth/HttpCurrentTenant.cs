using TempHire.Model;

namespace TempHire.Server.Auth
{
    /// <summary>
    /// The current request's tenant, read from the access token's <see cref="TenantIdClaim"/>.
    ///
    /// <para>
    /// The tenant is decided once, at sign-in, from the email domain of the user name, and signed
    /// into the token (see <see cref="TokenService"/>).  Nothing the client sends afterwards - no
    /// parameter, no header, no field of an entity, no instruction to Quinn - can change it.
    /// <c>TempHireDbContext</c> reads it for its query filter and its save checks.
    /// </para>
    /// </summary>
    public class HttpCurrentTenant : ICurrentTenant
    {
        public const string TenantIdClaim = "tenant_id";
        public const string TenantNameClaim = "tenant_name";

        private readonly IHttpContextAccessor _httpContextAccessor;

        public HttpCurrentTenant(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public Guid? TenantId =>
            Guid.TryParse(_httpContextAccessor.HttpContext?.User.FindFirst(TenantIdClaim)?.Value, out var id) ? id : null;
    }
}
