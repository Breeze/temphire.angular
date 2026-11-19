using System.Text.Json;
using System.Text.Json.Nodes;

namespace TempHire.Server.Validation
{
    /// <summary>
    /// TempHire's validation metadata, <c>Validation/validation.metadata.json</c>: the rules the server
    /// checks on save and the client loads at sign-in (see <c>ValidationController</c>).
    ///
    /// <para>
    /// The file has a <c>$schema</c>, for the editor, and a <c>$comment</c>.  <see cref="Json"/> is the
    /// same metadata without them, which is what both the server and the client are given, so they
    /// read exactly the same rules.
    /// </para>
    /// </summary>
    public sealed class ValidationMetadataFile
    {
        public ValidationMetadataFile(IHostEnvironment environment)
            : this(Path.Combine(environment.ContentRootPath, "Validation", "validation.metadata.json"))
        {
        }

        public ValidationMetadataFile(string path)
        {
            var node = JsonNode.Parse(
                File.ReadAllText(path),
                documentOptions: new JsonDocumentOptions
                {
                    CommentHandling = JsonCommentHandling.Skip,
                    AllowTrailingCommas = true,
                })!.AsObject();

            foreach (var key in node.Select(p => p.Key).Where(key => key.StartsWith('$')).ToList())
            {
                node.Remove(key);
            }
            Json = node.ToJsonString();
        }

        /// <summary>The metadata as plain JSON.</summary>
        public string Json { get; }
    }
}
