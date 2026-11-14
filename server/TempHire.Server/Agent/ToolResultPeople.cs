using System.Text.Json;
using Microsoft.Extensions.AI;

namespace TempHire.Server.Agent
{
    /// <summary>
    /// The staffing resources an answer can mention: the people in the tool results of that answer,
    /// each name with the id the tool returned.  Quinn's stream sends them to the client, which turns
    /// the names in the answer into links to the people's records.
    ///
    /// <para>
    /// The model does not write the links.  Asking it to copy GUIDs into URLs invites typos and
    /// invented ids, especially from a small local model.  And the server does not write them either:
    /// what a link to a person looks like is the client's business - its routes, or a mobile app's
    /// screens - so the server only says which names stand for which people.  Only people the tools
    /// actually returned are named, and always with the right id.
    /// </para>
    /// </summary>
    public static class ToolResultPeople
    {
        /// <summary>
        /// The people in <paramref name="results"/>: every JSON object with a GUID <c>id</c> and a
        /// <c>name</c>, or a <c>personId</c> and a <c>person</c>.  A tool result reaches the agent as
        /// MCP's <c>CallToolResult</c>, whose text content is itself JSON, so strings that look like
        /// JSON are parsed and searched as well.  A full name beats someone else's short form ("Jane
        /// Doe" for "Jane M Doe"); a name that still fits more than one person is left out, so it is
        /// never linked to the wrong one.
        /// </summary>
        public static IReadOnlyDictionary<string, Guid> In(IEnumerable<FunctionResultContent> results)
        {
            var names = new Names();

            foreach (var result in results)
            {
                if (result.Result is null)
                {
                    continue;
                }

                try
                {
                    var json = result.Result is JsonElement element ? element : JsonSerializer.SerializeToElement(result.Result);
                    Collect(json, names, depth: 0);
                }
                catch (Exception e) when (e is JsonException or NotSupportedException)
                {
                    // Not JSON: nothing to link from this result.
                }
            }

            // A person's full name is linked to them, even when it is also the short form of someone
            // else's: "Jane Doe" is Jane Doe, not Jane M Doe.  A short form is linked only when no one
            // has it as their full name and it is short for one person only.  Anything that still
            // fits more than one person stays plain text: a link would be a guess.
            var people = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
            foreach (var (name, ids) in names.Full.Where(n => n.Value.Count == 1))
            {
                people[name] = ids.Single();
            }

            foreach (var (name, ids) in names.Short.Where(n => n.Value.Count == 1 && !names.Full.ContainsKey(n.Key)))
            {
                people[name] = ids.Single();
            }

            return people;
        }

        /// <summary>The names found, each with the people who go by it: full names, and short forms.</summary>
        private sealed class Names
        {
            public Dictionary<string, HashSet<Guid>> Full { get; } = new(StringComparer.OrdinalIgnoreCase);

            public Dictionary<string, HashSet<Guid>> Short { get; } = new(StringComparer.OrdinalIgnoreCase);
        }

        private static void Collect(JsonElement json, Names people, int depth)
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

        private static void AddPerson(JsonElement json, string idProperty, string nameProperty, Names people)
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

            Add(people.Full, name, id);

            // "Nancy Lynn Davolio" is often written "Nancy Davolio".
            var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length > 2)
            {
                Add(people.Short, $"{parts[0]} {parts[^1]}", id);
            }
        }

        private static void Add(Dictionary<string, HashSet<Guid>> people, string name, Guid id)
        {
            if (!people.TryGetValue(name, out var ids))
            {
                people[name] = ids = [];
            }

            ids.Add(id);
        }
    }
}
