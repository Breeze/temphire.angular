using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.AI;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using TempHire.Server.Agent;
using TempHire.Server.Auth;

namespace TempHire.Server.Controllers
{
    /// <summary>
    /// Quinn's endpoint.  The Angular client sends the conversation so far and gets Quinn's answer, in
    /// Markdown.  The agent runs here, on the server, never in the browser: the model, its API key and
    /// the tools stay out of the client's reach.
    ///
    /// <para>
    /// The conversation lives in the client and is sent whole with each question, so the server keeps
    /// no chat state.  Only user and assistant messages are accepted; the system prompt is the
    /// server's alone.
    /// </para>
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/agent/[action]")]
    public class AgentController : ControllerBase
    {
        private const int MaxMessages = 30;
        private const int MaxMessageLength = 4000;

        /// <summary>How the stream's updates are written: camelCase, without empty properties.</summary>
        private static readonly System.Text.Json.JsonSerializerOptions UpdateJson =
            new(System.Text.Json.JsonSerializerOptions.Web)
            {
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            };

        private readonly QuinnAgent _agent;
        private readonly ChatClientFactory _chatClients;
        private readonly ILogger<AgentController> _logger;

        public AgentController(QuinnAgent agent, ChatClientFactory chatClients, ILogger<AgentController> logger)
        {
            _agent = agent;
            _chatClients = chatClients;
            _logger = logger;
        }

        /// <summary>Who answers: Quinn's name and the model, for the chat pane's header.</summary>
        [HttpGet]
        public ActionResult<AgentInfo> Info() => new AgentInfo
        {
            Name = QuinnPersona.Name,
            Model = _chatClients.Options.ModelLabel,
            CompanyName = CompanyName
        };

        /// <summary>
        /// Answers the last question of the conversation, streamed as newline-delimited JSON
        /// (<c>application/x-ndjson</c>): one <see cref="QuinnUpdate"/> per line - <c>text</c> pieces as
        /// the model writes them, the <c>people</c> the answer can mention as the tools return them,
        /// and <c>done</c> at the end.  Turning those people into links is up to the client.
        ///
        /// <para>
        /// Nothing is sent until the first piece is ready, so a failure to start - Ollama not
        /// running, no API key - still answers with an error status.  A failure after that can only
        /// be reported in the stream, as an <c>error</c> line.
        /// </para>
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Chat([FromBody] ChatRequest request, CancellationToken cancellationToken)
        {
            var conversation = (request?.Messages ?? [])
                .Where(m => !string.IsNullOrWhiteSpace(m?.Content))
                .TakeLast(MaxMessages)
                .Select(m => new ChatMessage(
                    m.Role == "assistant" ? ChatRole.Assistant : ChatRole.User,
                    m.Content.Length > MaxMessageLength ? m.Content[..MaxMessageLength] : m.Content))
                .ToList();

            if (conversation.Count == 0 || conversation[^1].Role != ChatRole.User)
            {
                return BadRequest(new ErrorResult { Message = "Ask Quinn a question." });
            }

            var updates = _agent.AskStreamingAsync(
                    conversation,
                    new Uri($"{Request.Scheme}://{Request.Host}/mcp"),
                    AccessToken,
                    CompanyName,
                    User.Identity?.Name ?? "a TempHire user",
                    cancellationToken)
                .GetAsyncEnumerator(cancellationToken);

            try
            {
                bool more;
                try
                {
                    more = await updates.MoveNextAsync();
                }
                catch (Exception e) when (e is not OperationCanceledException)
                {
                    return Unavailable(FailureMessage(e));
                }

                Response.ContentType = "application/x-ndjson; charset=utf-8";
                Response.Headers.CacheControl = "no-cache";

                try
                {
                    for (; more; more = await updates.MoveNextAsync())
                    {
                        await WriteLineAsync(updates.Current, cancellationToken);
                    }
                }
                catch (Exception e) when (e is not OperationCanceledException)
                {
                    await WriteLineAsync(QuinnUpdate.Error(FailureMessage(e)), cancellationToken);
                }

                return new EmptyResult();
            }
            finally
            {
                await updates.DisposeAsync();
            }
        }

        /// <summary>Sends one update and flushes it, so the client sees it now.</summary>
        private async Task WriteLineAsync(QuinnUpdate update, CancellationToken cancellationToken)
        {
            await Response.WriteAsync(
                System.Text.Json.JsonSerializer.Serialize(update, UpdateJson) + "\n",
                cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }

        /// <summary>What to tell the user when Quinn cannot answer; the details go to the log.</summary>
        private string FailureMessage(Exception e)
        {
            switch (e)
            {
                case AgentNotConfiguredException:
                    return e.Message;

                case HttpRequestException when !_chatClients.Options.UsesClaude:
                    _logger.LogWarning(e, "Quinn could not reach Ollama.");
                    return $"Quinn can't reach Ollama at {_chatClients.Options.Ollama.Endpoint}. Is it running, " +
                           $"with the model downloaded (ollama pull {_chatClients.Options.Ollama.Model})?";

                default:
                    _logger.LogError(e, "Quinn failed to answer.");
                    return "Quinn ran into a problem answering that. Please try again.";
            }
        }

        private string CompanyName => User.FindFirst(HttpCurrentTenant.TenantNameClaim)?.Value ?? "your company";

        /// <summary>The caller's own token, passed on to the MCP endpoint.</summary>
        private string AccessToken =>
            Request.Headers.Authorization.ToString() is var header && header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                ? header["Bearer ".Length..].Trim()
                : null;

        private ObjectResult Unavailable(string message) =>
            StatusCode((int)HttpStatusCode.ServiceUnavailable, new ErrorResult { Message = message });
    }

    // camelCase for the same reason as the account DTOs: see the comment in AccountController.cs.

    [JsonObject(NamingStrategyType = typeof(CamelCaseNamingStrategy))]
    public class ChatRequest
    {
        public List<ChatRequestMessage> Messages { get; set; }
    }

    [JsonObject(NamingStrategyType = typeof(CamelCaseNamingStrategy))]
    public class ChatRequestMessage
    {
        /// <summary><c>user</c> or <c>assistant</c>.</summary>
        public string Role { get; set; }

        public string Content { get; set; }
    }

    [JsonObject(NamingStrategyType = typeof(CamelCaseNamingStrategy))]
    public class AgentInfo
    {
        public string Name { get; set; }
        public string Model { get; set; }
        public string CompanyName { get; set; }
    }
}
