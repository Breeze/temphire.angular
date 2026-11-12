using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Security.Cryptography;
using System.Text;

namespace TempHire.Model
{
    /// <summary>
    /// Ported from <c>Security/User.cs</c>.
    /// <para>
    /// The DevForce version was decorated with <c>[ClientCanQuery(false)]</c>, which kept it out of the
    /// client's reach entirely.  There is no Breeze attribute for that, and none is needed: the type is
    /// simply not exposed by <c>BreezeController</c> and lives in its own DbContext / database, so it
    /// never appears in the Breeze metadata the client downloads.
    /// </para>
    /// <para>
    /// <b>Security change.</b>  The original stored the password AES-encrypted with a key derived from
    /// the password itself, then "authenticated" by decrypting and comparing - a reversible scheme that
    /// is no longer acceptable.  This version stores a one-way PBKDF2-HMAC-SHA256 hash.
    /// </para>
    /// </summary>
    public class User
    {
        // OWASP-recommended floor for PBKDF2-HMAC-SHA256.
        private const int Iterations = 210_000;
        private const int SaltSize = 16;
        private const int KeySize = 32;

        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.None)]
        public Guid Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Username { get; set; }

        /// <summary>Encoded as <c>iterations.base64(salt).base64(hash)</c>.</summary>
        [Required]
        [MaxLength(256)]
        public string PasswordHash { get; set; }

        public static User Create(string username, string password)
        {
            var user = new User { Id = Guid.NewGuid(), Username = username };
            user.SetPassword(password);
            return user;
        }

        public void SetPassword(string password)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(password);

            var salt = RandomNumberGenerator.GetBytes(SaltSize);
            var hash = Rfc2898DeriveBytes.Pbkdf2(
                Encoding.UTF8.GetBytes(password), salt, Iterations, HashAlgorithmName.SHA256, KeySize);

            PasswordHash = string.Join('.', Iterations, Convert.ToBase64String(salt), Convert.ToBase64String(hash));
        }

        public bool Authenticate(string password)
        {
            if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(PasswordHash))
            {
                return false;
            }

            var parts = PasswordHash.Split('.');
            if (parts.Length != 3 || !int.TryParse(parts[0], out var iterations))
            {
                return false;
            }

            try
            {
                var salt = Convert.FromBase64String(parts[1]);
                var expected = Convert.FromBase64String(parts[2]);
                var actual = Rfc2898DeriveBytes.Pbkdf2(
                    Encoding.UTF8.GetBytes(password), salt, iterations, HashAlgorithmName.SHA256, expected.Length);

                return CryptographicOperations.FixedTimeEquals(actual, expected);
            }
            catch (FormatException)
            {
                return false;
            }
        }
    }
}
