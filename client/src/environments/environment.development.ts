export const environment = {
  production: false,
  // The Angular dev server runs on 4200 and TempHire.Server on 5000 (see launchSettings.json),
  // so during development the client talks to the API cross-origin.  The server's CORS policy
  // allows http://localhost:4200.
  breezeApiRoot: 'http://localhost:5000/api/breeze',
  accountApiRoot: 'http://localhost:5000/api/account',
};
