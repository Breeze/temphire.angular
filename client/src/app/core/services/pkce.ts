/**
 * PKCE (RFC 7636) for the Authorization Code flow.
 *
 * The app makes up a random secret, the *verifier*, and sends only its SHA-256 hash, the
 * *challenge*, with the sign-in request.  When the code comes back, the app redeems it together
 * with the verifier, and the server checks that the two match.  A code that someone else
 * intercepts is useless to them without the verifier, which never left this browser tab.
 */

/** A random URL-safe string: 32 random bytes, base64url-encoded (43 characters). */
export function randomString(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/** The S256 challenge for a verifier: base64url(SHA-256(verifier)). */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
