namespace TempHire.Server.Auth
{
    /// <summary>Bound from the <c>Jwt</c> section of appsettings.json.</summary>
    public class JwtOptions
    {
        public const string SectionName = "Jwt";

        public string Issuer { get; set; } = "TempHire";
        public string Audience { get; set; } = "TempHireClient";

        /// <summary>
        /// Symmetric signing key.  The development value in appsettings.json is a placeholder - replace
        /// it (user-secrets, environment variable, key vault) before running anywhere real.
        /// </summary>
        public string SigningKey { get; set; }

        public int ExpiryMinutes { get; set; } = 480;
    }
}
