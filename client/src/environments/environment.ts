export const environment = {
  production: true,
  /** Root of the Breeze controller - see `BreezeController`'s `[Route("api/breeze/[action]")]`. */
  breezeApiRoot: '/api/breeze',
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
