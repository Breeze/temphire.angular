using Microsoft.Extensions.AI;
using ModelContextProtocol.Client;

namespace TempHire.Server.Agent
{
    /// <summary>
    /// Quinn: answers one question, using the language model and the MCP server's tools, and streams
    /// the answer as it is written.
    ///
    /// <para>
    /// The tools come from this same server's MCP endpoint (<c>/mcp</c>), called over HTTP with the
    /// <b>user's own access token</b>.  So the agent has no special access: the MCP endpoint checks
    /// the token like any other request, and the tools see only the user's tenant.  The model never
    /// sees the token or the tenant id.
    /// </para>
    /// <para>
    /// Going over HTTP to its own server costs a little, but it keeps one security boundary: the MCP
    /// endpoint.  The same endpoint serves other MCP clients, such as Claude Code, with the same rules.
    /// </para>
    /// </summary>
    public class QuinnAgent
    {
        private readonly ChatClientFactory _chatClients;
        private readonly IHttpClientFactory _httpClients;
        private readonly ILoggerFactory _loggerFactory;

        public QuinnAgent(ChatClientFactory chatClients, IHttpClientFactory httpClients, ILoggerFactory loggerFactory)
        {
            _chatClients = chatClients;
            _httpClients = httpClients;
            _loggerFactory = loggerFactory;
        }

        /// <summary>
        /// Answers as a stream: the text as the model writes it, piece by piece, then the whole answer
        /// once more with the people in it linked.
        ///
        /// <para>
        /// The links can only be added at the end.  The people to link come from the tool results,
        /// and a name can be split across two pieces ("Nancy Da" + "volio").  So the pieces are plain
        /// text, and the client swaps in the linked answer when it arrives.  The tool calls run
        /// before the model writes its answer, so nothing streams while they do.
        /// </para>
        /// </summary>
        public async IAsyncEnumerable<QuinnUpdate> AskStreamingAsync(
            IReadOnlyList<ChatMessage> conversation,
            Uri mcpEndpoint,
            string accessToken,
            string companyName,
            string userName,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await using var mcp = await ConnectAsync(mcpEndpoint, accessToken, cancellationToken);
            var tools = await mcp.ListToolsAsync(cancellationToken: cancellationToken);

            var updates = new List<ChatResponseUpdate>();
            await foreach (var update in _chatClients.Client.GetStreamingResponseAsync(
                Messages(conversation, companyName, userName),
                new ChatOptions { Tools = [.. tools] },
                cancellationToken))
            {
                // Every update is kept, tool calls and results included, to put the response
                // together at the end; only the text goes to the client now.
                updates.Add(update);
                if (update.Role != ChatRole.Tool && !string.IsNullOrEmpty(update.Text))
                {
                    yield return QuinnUpdate.Text(update.Text);
                }
            }

            var response = updates.ToChatResponse();
            yield return QuinnUpdate.Done(ResourceLinker.LinkResources(response.Text, response));
        }

        /// <summary>
        /// Connects to the MCP endpoint as the user.  The caller disposes the client when the answer
        /// is done, which closes the connection.
        /// </summary>
        private async Task<McpClient> ConnectAsync(Uri mcpEndpoint, string accessToken, CancellationToken cancellationToken)
        {
            var transport = new HttpClientTransport(
                new HttpClientTransportOptions
                {
                    Endpoint = mcpEndpoint,
                    Name = "TempHire",
                    AdditionalHeaders = new Dictionary<string, string> { ["Authorization"] = $"Bearer {accessToken}" }
                },
                _httpClients.CreateClient(nameof(QuinnAgent)),
                _loggerFactory);

            return await McpClient.CreateAsync(transport, loggerFactory: _loggerFactory, cancellationToken: cancellationToken);
        }

        /// <summary>The system prompt, then the conversation so far.</summary>
        private static List<ChatMessage> Messages(IReadOnlyList<ChatMessage> conversation, string companyName, string userName)
        {
            var messages = new List<ChatMessage>
            {
                new(ChatRole.System, QuinnPersona.SystemPrompt(companyName, userName, DateTime.Today))
            };
            messages.AddRange(conversation);
            return messages;
        }
    }

    /// <summary>
    /// One piece of a streamed answer: some <c>text</c> as the model writes it, or <c>done</c> with
    /// the whole answer, its people linked, or an <c>error</c>.  Sent to the client as one JSON object
    /// per line.
    /// </summary>
    public record QuinnUpdate(string Type, string Content)
    {
        public static QuinnUpdate Text(string text) => new("text", text);

        public static QuinnUpdate Done(string answer) => new("done", answer);

        public static QuinnUpdate Error(string message) => new("error", message);
    }
}
