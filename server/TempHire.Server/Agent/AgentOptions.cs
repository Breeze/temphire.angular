namespace TempHire.Server.Agent
{
    /// <summary>
    /// The <c>Agent</c> section of appsettings.json: which language model Quinn uses.
    ///
    /// <para>
    /// <see cref="Provider"/> switches between a free local model through Ollama and Claude through
    /// the Anthropic API.  The Claude API key is a secret and never goes in appsettings.json: store it
    /// with <c>server\Set-ClaudeApiKey.ps1</c>, which puts it in the user-secrets store as
    /// <c>Agent:Claude:ApiKey</c>.
    /// </para>
    /// </summary>
    public class AgentOptions
    {
        public const string SectionName = "Agent";

        /// <summary><c>Ollama</c> (default) or <c>Claude</c>.</summary>
        public string Provider { get; set; } = "Ollama";

        /// <summary>The most tool calls Quinn may make for one question; a safety stop against loops.</summary>
        public int MaxToolCalls { get; set; } = 8;

        public ClaudeOptions Claude { get; set; } = new();

        public OllamaOptions Ollama { get; set; } = new();

        public bool UsesClaude => string.Equals(Provider, "Claude", StringComparison.OrdinalIgnoreCase);

        /// <summary>The model that answers, for display.</summary>
        public string ModelLabel => UsesClaude ? Claude.Model : $"{Ollama.Model} via Ollama";
    }

    public class ClaudeOptions
    {
        public string Model { get; set; } = "claude-sonnet-5-5";

        /// <summary>From user-secrets (<c>Agent:Claude:ApiKey</c>), never from appsettings.json.</summary>
        public string ApiKey { get; set; }

        public int MaxTokens { get; set; } = 4096;
    }

    public class OllamaOptions
    {
        public string Endpoint { get; set; } = "http://127.0.0.1:11434";

        /// <summary>Must support tool calling, and be downloaded first: <c>ollama pull &lt;name&gt;</c>.</summary>
        public string Model { get; set; } = "qwen3:4b-instruct";
    }
}
