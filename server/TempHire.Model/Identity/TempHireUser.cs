using Microsoft.AspNetCore.Identity;

namespace TempHire.Model.Identity
{
    /// <summary>
    /// A user of TempHire, kept by ASP.NET Core Identity.  Successor of <c>Security/User.cs</c>, the
    /// original's hand-rolled user table.
    ///
    /// <para>
    /// The user name is an email address, and Identity stores it twice, as <c>UserName</c> and
    /// <c>Email</c>.  Nothing here says which company the user belongs to: the tenant is the one whose
    /// email domain matches, decided at each sign-in (see <c>TenantResolver</c> in the server).  The
    /// same rule serves users of an external identity provider such as Microsoft Entra ID, whose email
    /// domain is one the company owns.
    /// </para>
    /// <para>
    /// Identity keeps passwords as salted PBKDF2 hashes, counts failed sign-ins for lockout, and keeps
    /// external logins (provider and key) in <c>AspNetUserLogins</c>, ready for a provider to be added.
    /// </para>
    /// </summary>
    public class TempHireUser : IdentityUser<Guid>
    {
        public TempHireUser()
        {
        }

        public TempHireUser(string email)
        {
            Id = Guid.NewGuid();
            UserName = email;
            Email = email;
        }
    }
}
