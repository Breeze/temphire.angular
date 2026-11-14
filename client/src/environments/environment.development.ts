export const environment = {
  production: false,
  // The Angular dev server runs on 4200 and TempHire.Server on 5000 (see launchSettings.json),
  // so during development the client talks to the API cross-origin.  The server's CORS policy
  // allows http://localhost:4200.
  breezeApiRoot: 'http://localhost:5000/api/breeze',
  accountApiRoot: 'http://localhost:5000/api/account',
  agentApiRoot: 'http://localhost:5000/api/agent',
  /** The users the server seeds (see `DatabaseSetup`), offered as one-click sign-ins. */
  sampleLogins: {
    password: 'password',
    companies: [
      { name: 'Harbor Staffing', users: ['anna@harbor.test', 'ben@harbor.test'] },
      { name: 'Summit Talent', users: ['carla@summit.test', 'david@summit.test'] },
    ],
  },
};
