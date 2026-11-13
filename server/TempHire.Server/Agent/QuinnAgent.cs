using Microsoft.Extensions.AI;
using ModelContextProtocol.Client;

namespace TempHire.Server.Agent
{
    /// <summary>
    /// Quinn: answers one question, using the language model and the MCP server's tools.
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

        public async Task<string> AskAsync(
            IReadOnlyList<ChatMessage> conversation,
            Uri mcpEndpoint,
            string accessToken,
            string companyName,
            string userName,
            CancellationToken cancellationToken)
        {
            var chat = _chatClients.Client;

            var transport = new HttpClientTransport(
                new HttpClientTransportOptions
                {
                    Endpoint = mcpEndpoint,
                    Name = "TempHire",
                    AdditionalHeaders = new Dictionary<string, string> { ["Authorization"] = $"Bearer {accessToken}" }
                },
                _httpClients.CreateClient(nameof(QuinnAgent)),
                _loggerFactory);

            await using var mcp = await McpClient.CreateAsync(transport, loggerFactory: _loggerFactory, cancellationToken: cancellationToken);
            var tools = await mcp.ListToolsAsync(cancellationToken: cancellationToken);

            var messages = new List<ChatMessage>
            {
                new(ChatRole.System, QuinnPersona.SystemPrompt(companyName, userName, DateTime.Today))
            };
            messages.AddRange(conversation);

            var response = await chat.GetResponseAsync(
                messages,
                new ChatOptions { Tools = [.. tools] },
                cancellationToken);

            // The response keeps the tool calls and results made along the way; the people in them
            // become links in the answer.
            return ResourceLinker.LinkResources(response.Text, response);
        }
    }
}
