namespace TempHire.Model.Identity
{
    /// <summary>
    /// The roles a user can have, kept by ASP.NET Core Identity and signed into the access token.
    ///
    /// <list type="bullet">
    ///   <item><b>Editor</b>: sees the company's staffing resources and changes them.</item>
    ///   <item><b>Reader</b>: sees them, and changes nothing.</item>
    /// </list>
    /// A user with neither is signed in but sees no staffing data: the Home page and the shared
    /// lookups only.
    /// </summary>
    public static class TempHireRoles
    {
        public const string Editor = "Editor";
        public const string Reader = "Reader";

        /// <summary>The roles that may read the staffing data, for <c>[Authorize(Roles = ...)]</c>.</summary>
        public const string ReadStaffingData = Editor + "," + Reader;

        /// <summary>Every role, in the order they are seeded.</summary>
        public static readonly string[] All = [Editor, Reader];
    }
}
