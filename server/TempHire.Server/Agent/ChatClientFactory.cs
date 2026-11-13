using Anthropic;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using OllamaSharp;

namespace TempHire.Server.Agent
{
    /// <summary>
    /// Builds the chat client Quinn talks to, for the configured provider.
    ///
    /// <para>
    /// Both providers are used through <see cref="IChatClient"/> from Microsoft.Extensions.AI, so the
    /// rest of the agent does not know which one it has.  <c>UseFunctionInvocation</c> adds the tool
    /// loop: when the model asks for a tool, the client calls it (here: an MCP tool) and sends the
    /// result back, until the model answers in text.  That is the loop the RAG example wrote by hand
    /// in Part 4 and got from the Vercel AI SDK in Part 5.
    /// </para>
    /// <para>A singleton: the underlying clients hold an HttpClient and are safe to share.</para>
    /// </summary>
    public class ChatClientFactory : IDisposable
    {
        private readonly AgentOptions _options;
        private readonly Lazy<IChatClient> _client;

        public ChatClientFactory(IOptions<AgentOptions> options)
        {
            _options = options.Value;
            _client = new Lazy<IChatClient>(Build);
        }

        public AgentOptions Options => _options;

        /// <summary>The chat client with the tool loop.  Throws <see cref="AgentNotConfiguredException"/>.</summary>
        public IChatClient Client => _client.Value;

        private IChatClient Build()
        {
            IChatClient model;

            if (_options.UsesClaude)
            {
                if (string.IsNullOrWhiteSpace(_options.Claude.ApiKey))
                {
                    throw new AgentNotConfiguredException(
                        "Quinn is set up to use Claude, but there is no API key. " +
                        "Run server\\Set-ClaudeApiKey.ps1 to store one, then restart the server.");
                }

                model = new AnthropicClient { ApiKey = _options.Claude.ApiKey }
                    .AsIChatClient(_options.Claude.Model, _options.Claude.MaxTokens);
            }
            else
            {
                model = new OllamaApiClient(new Uri(_options.Ollama.Endpoint), _options.Ollama.Model);
            }

            return new ChatClientBuilder(model)
                .UseFunctionInvocation(configure: loop => loop.MaximumIterationsPerRequest = _options.MaxToolCalls)
                .Build();
        }

        public void Dispose()
        {
            if (_client.IsValueCreated)
            {
                _client.Value.Dispose();
            }
        }
    }

    /// <summary>The agent cannot run as configured; the message says what to do.</summary>
    public class AgentNotConfiguredException : InvalidOperationException
    {
        public AgentNotConfiguredException(string message) : base(message)
        {
        }
    }
}
