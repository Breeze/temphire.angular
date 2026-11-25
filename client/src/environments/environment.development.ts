export const environment = {
  production: false,
  // The Angular dev server runs on 4200 and TempHire.Server on 5000 (see launchSettings.json),
  // so during development the client talks to the API cross-origin.  The server's CORS policy
  // allows http://localhost:4200.
  modelApiRoot: 'http://localhost:5000/api/model',
  lookupsApiRoot: 'http://localhost:5000/api/lookups',
  resourceMgtApiRoot: 'http://localhost:5000/api/resourcemgt',
  validationApiRoot: 'http://localhost:5000/api/validation',
  accountApiRoot: 'http://localhost:5000/api/account',
  agentApiRoot: 'http://localhost:5000/api/agent',
  usageApiRoot: 'http://localhost:5000/api/usage',
  addressApiRoot: 'http://localhost:5000/api/address',
  /**
   * The OAuth authorization server: TempHire.Server itself.  The browser goes there to sign in
   * (the sample users are offered on its sign-in page), and the app gets its tokens from there.
   */
  authority: 'http://localhost:5000',
};
