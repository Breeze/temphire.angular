export const environment = {
  production: true,
  /** The Breeze model's metadata, loaded at sign-in - see `ModelController`. */
  modelApiRoot: '/api/model',
  /** The lookups, loaded at sign-in for every unit of work - see `LookupsController`. */
  lookupsApiRoot: '/api/lookups',
  /** The Resource Management workspace's queries and saves - see `ResourceMgtController`. */
  resourceMgtApiRoot: '/api/resourcemgt',
  /** Root of the validation controller: the validation metadata, see `ValidationController`. */
  validationApiRoot: '/api/validation',
  /** Root of the account controller: who the signed-in user is. */
  accountApiRoot: '/api/account',
  /** Root of the agent controller - Quinn, see `AgentController`. */
  agentApiRoot: '/api/agent',
  /** Quinn's token usage and quotas for the signed-in user - see `UsageController`. */
  usageApiRoot: '/api/usage',
  /**
   * The OAuth authorization server.  Empty: the server that serves the app, whose origin
   * `AuthService` uses.
   */
  authority: '',
};
