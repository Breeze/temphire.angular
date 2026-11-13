using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TempHire.Model
{
    /// <summary>
    /// A company using TempHire.  All tenants share the same tables; every tenant-owned row carries
    /// the tenant's <see cref="Id"/> (the "shared schema" design).
    ///
    /// <para>
    /// A user belongs to the tenant whose <see cref="EmailDomain"/> matches the domain of their user
    /// name: <c>anna@harbor.test</c> belongs to the tenant with domain <c>harbor.test</c>.  The match
    /// is made once, at sign-in, and the tenant's id goes into the access token (see
    /// <c>TokenService</c>).  The id is a GUID rather than the domain itself, so a company can
    /// change its domain without its data changing hands.
    /// </para>
    /// </summary>
    public class Tenant
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public Guid Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; }

        [Required]
        [MaxLength(100)]
        public string EmailDomain { get; set; }

        /// <summary>The lower-case email domain of a user name: <c>harbor.test</c> for <c>anna@harbor.test</c>, or null.</summary>
        public static string DomainOf(string userName)
        {
            if (string.IsNullOrWhiteSpace(userName))
            {
                return null;
            }

            var at = userName.LastIndexOf('@');
            return at > 0 && at < userName.Length - 1 ? userName[(at + 1)..].Trim().ToLowerInvariant() : null;
        }
    }
}
