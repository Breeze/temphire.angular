export const environment = {
  production: true,
  /** Root of the Breeze controller - see `BreezeController`'s `[Route("api/breeze/[action]")]`. */
  breezeApiRoot: '/api/breeze',
  /** Root of the account controller used for login / logout. */
  accountApiRoot: '/api/account',
  /** Root of the agent controller - Quinn, see `AgentController`. */
  agentApiRoot: '/api/agent',
  /**
   * Seeded users the login page offers as one-click sign-ins, a convenience for development only
   * (see `environment.development.ts`).  None in production, so they are not even in the bundle.
   */
  sampleLogins: undefined as
    | { password: string; companies: { name: string; users: string[] }[] }
    | undefined,
};
