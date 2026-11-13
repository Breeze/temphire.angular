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

        [HttpPost]
        public async Task<ActionResult<ChatReply>> Chat([FromBody] ChatRequest request, CancellationToken cancellationToken)
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

            try
            {
                var answer = await _agent.AskAsync(
                    conversation,
                    new Uri($"{Request.Scheme}://{Request.Host}/mcp"),
                    AccessToken,
                    CompanyName,
                    User.Identity?.Name ?? "a TempHire user",
                    cancellationToken);

                return new ChatReply { Content = answer };
            }
            catch (AgentNotConfiguredException e)
            {
                return Unavailable(e.Message);
            }
            catch (HttpRequestException e) when (!_chatClients.Options.UsesClaude)
            {
                _logger.LogWarning(e, "Quinn could not reach Ollama.");
                return Unavailable(
                    $"Quinn can't reach Ollama at {_chatClients.Options.Ollama.Endpoint}. Is it running, " +
                    $"with the model downloaded (ollama pull {_chatClients.Options.Ollama.Model})?");
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                _logger.LogError(e, "Quinn failed to answer.");
                return Unavailable("Quinn ran into a problem answering that. Please try again.");
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
    public class ChatReply
    {
        /// <summary>Quinn's answer, in Markdown.</summary>
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
