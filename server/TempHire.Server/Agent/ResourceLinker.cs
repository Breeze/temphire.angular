using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.AI;

namespace TempHire.Server.Agent
{
    /// <summary>
    /// Turns the names of staffing resources in Quinn's answer into Markdown links that open them in
    /// Resource Management: <c>[Nancy Davolio](/resourcemgt?resource=&lt;id&gt;)</c>.
    ///
    /// <para>
    /// The model does not write the links.  Asking it to copy GUIDs into URLs invites typos and
    /// invented ids, especially from a small local model.  Instead the people come from the tool
    /// results of this very answer, each with the id the tool returned, and their names are linked
    /// where they appear in the text.  So only people the tools actually returned are linked, and
    /// always to the right record.
    /// </para>
    /// </summary>
    public static class ResourceLinker
    {
        /// <summary>The client route that opens a staffing resource.</summary>
        public const string LinkPrefix = "/resourcemgt?resource=";

        /// <summary>Links the people found in the tool results of <paramref name="response"/>.</summary>
        public static string LinkResources(string markdown, ChatResponse response)
        {
            var people = PeopleIn(response);
            return people.Count == 0 ? markdown : LinkNames(markdown, people);
        }

        /// <summary>
        /// Links each occurrence of the names in <paramref name="people"/> (name → id), leaving code
        /// and existing links alone.  Longer names win, so "Nancy Lynn Davolio" is one link, not
        /// "Nancy" plus something else.
        /// </summary>
        public static string LinkNames(string markdown, IReadOnlyDictionary<string, Guid> people)
        {
            if (string.IsNullOrEmpty(markdown) || people.Count == 0)
            {
                return markdown;
            }

            var names = people.Keys.OrderByDescending(n => n.Length).Select(Regex.Escape);
            var namePattern = new Regex(
                $@"(?<![\w\[])(?:{string.Join("|", names)})(?![\w\]])",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

            // Split into protected pieces (code blocks, code spans, links, images) and plain text,
            // and link names in the plain text only.
            var protectedPattern = new Regex(@"```[\s\S]*?```|`[^`\n]*`|!?\[[^\]\n]*\]\([^)\n]*\)");
            var result = new System.Text.StringBuilder();
            var position = 0;

            foreach (Match match in protectedPattern.Matches(markdown))
            {
                result.Append(Link(markdown[position..match.Index]));
                result.Append(match.Value);
                position = match.Index + match.Length;
            }

            result.Append(Link(markdown[position..]));
            return result.ToString();

            string Link(string text) =>
                namePattern.Replace(text, m => people.TryGetValue(m.Value, out var id) ? $"[{m.Value}]({LinkPrefix}{id})" : m.Value);
        }

        /// <summary>
        /// The people in the tool results: every JSON object with a GUID <c>id</c> and a <c>name</c>,
        /// or a <c>personId</c> and a <c>person</c>.  A tool result reaches the agent as MCP's
        /// <c>CallToolResult</c>, whose text content is itself JSON, so strings that look like JSON
        /// are parsed and searched as well.
        /// </summary>
        public static IReadOnlyDictionary<string, Guid> PeopleIn(ChatResponse response)
        {
            var people = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);

            foreach (var result in response.Messages.SelectMany(m => m.Contents).OfType<FunctionResultContent>())
            {
                if (result.Result is null)
                {
                    continue;
                }

                try
                {
                    var json = result.Result is JsonElement element ? element : JsonSerializer.SerializeToElement(result.Result);
                    Collect(json, people, depth: 0);
                }
                catch (Exception e) when (e is JsonException or NotSupportedException)
                {
                    // Not JSON: nothing to link from this result.
                }
            }

            return people;
        }

        private static void Collect(JsonElement json, Dictionary<string, Guid> people, int depth)
        {
            if (depth > 12)
            {
                return;
            }

            switch (json.ValueKind)
            {
                case JsonValueKind.Object:
                    AddPerson(json, "id", "name", people);
                    AddPerson(json, "personId", "person", people);
                    foreach (var property in json.EnumerateObject())
                    {
                        Collect(property.Value, people, depth + 1);
                    }
                    break;

                case JsonValueKind.Array:
                    foreach (var item in json.EnumerateArray())
                    {
                        Collect(item, people, depth + 1);
                    }
                    break;

                case JsonValueKind.String:
                    var text = json.GetString()!.TrimStart();
                    if (text.StartsWith('{') || text.StartsWith('['))
                    {
                        try
                        {
                            using var document = JsonDocument.Parse(text);
                            Collect(document.RootElement, people, depth + 1);
                        }
                        catch (JsonException)
                        {
                            // A string that only looked like JSON.
                        }
                    }
                    break;
            }
        }

        private static void AddPerson(JsonElement json, string idProperty, string nameProperty, Dictionary<string, Guid> people)
        {
            if (!json.TryGetProperty(idProperty, out var idValue) || idValue.ValueKind != JsonValueKind.String ||
                !Guid.TryParse(idValue.GetString(), out var id) ||
                !json.TryGetProperty(nameProperty, out var nameValue) || nameValue.ValueKind != JsonValueKind.String)
            {
                return;
            }

            var name = nameValue.GetString()!.Trim();
            if (name.Length == 0)
            {
                return;
            }

            people.TryAdd(name, id);

            // "Nancy Lynn Davolio" is often written "Nancy Davolio".
            var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length > 2)
            {
                people.TryAdd($"{parts[0]} {parts[^1]}", id);
            }
        }
    }
}
