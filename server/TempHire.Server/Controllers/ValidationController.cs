using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TempHire.Server.Validation;

namespace TempHire.Server.Controllers
{
    /// <summary>
    /// Serves the validation metadata, the counterpart of <see cref="BreezeController.Metadata"/>: the
    /// client loads both at sign-in.  The Breeze metadata brings the rules from the entities' data
    /// annotations; this brings the rest (<c>Validation/validation.metadata.json</c>), which the client
    /// installs into Breeze, so both are checked as the user edits and before a save, and again by the
    /// server when it saves.
    ///
    /// <para>
    /// Like the Breeze metadata, it needs a signed-in user but no particular role.
    /// </para>
    /// </summary>
    [Route("api/validation/[action]")]
    [Authorize]
    public class ValidationController(ValidationMetadataFile metadata) : ControllerBase
    {
        [HttpGet]
        public ContentResult Metadata() => Content(metadata.Json, "application/json");
    }
}
