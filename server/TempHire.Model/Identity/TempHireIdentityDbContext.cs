using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace TempHire.Model.Identity
{
    /// <summary>
    /// The identity database: ASP.NET Core Identity's users, logins, claims, tokens and roles, with
    /// Guid keys.  Successor of <c>SecurityDbContext</c>.
    ///
    /// <para>
    /// A database of its own, as the original's security store was (TempHire.Security.sdf).  It never
    /// reaches the client: <c>BreezeController</c> works on <c>TempHireDbContext</c> only, so none of
    /// these types is in the Breeze metadata, and no tenant filter applies here - users are looked up
    /// before anyone is signed in.
    /// </para>
    /// </summary>
    public class TempHireIdentityDbContext : IdentityDbContext<TempHireUser, IdentityRole<Guid>, Guid>
    {
        public TempHireIdentityDbContext(DbContextOptions<TempHireIdentityDbContext> options) : base(options)
        {
        }
    }
}
