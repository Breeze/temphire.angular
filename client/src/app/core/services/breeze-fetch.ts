import type { BreezeFetch } from 'breeze-client';

/**
 * WORKAROUND for a breeze-client 3.0.0 bug - remove once the fix is released.
 *
 * Breeze 3.0.0 reads every successful response with `response.json()`, which throws on an empty
 * body.  So a request answered with **204 No Content** - what ASP.NET Core sends whenever a
 * controller action returns `null` - or with a 200 and no body is rejected instead of resolving.
 * The error's `message` is the parser's (`SyntaxError: Unexpected end of JSON input` in Chromium),
 * its `status` the real one (204), and its `statusText` begins "Unable to read the response
 * body".  Breeze 2's `HttpClient`
 * adapter read such a response as `null`, so an endpoint that worked under 2.x can start failing
 * after the upgrade.
 *
 * This wraps Breeze's fetch function so that an empty successful response carries a JSON `null`,
 * which Breeze reads as "no data" (a query resolves with `results` as an empty array).  A body
 * that is not empty is passed through untouched, so a non-JSON page from a proxy still fails as it
 * should.  It is the workaround documented in the breeze-client release notes:
 * https://github.com/Breeze/breeze-client-v3/blob/fix/empty-response-body/RELEASE-NOTES.md
 *
 * The fix is on the `fix/empty-response-body` branch of breeze-client-v3.  Once a release with it
 * is installed, delete this file, use `httpClientFetch(...)` directly in `app.config.ts`, and
 * delete `breeze-fetch.spec.ts`; its "without the workaround" test is what will tell you the fix
 * has arrived, because it will start failing.
 */
export function emptyBodyAsNull(fetchFn: BreezeFetch): BreezeFetch {
  return async (input, init) => {
    const response = await fetchFn(input, init);
    const empty = response.status === 204 || response.headers.get('content-length') === '0';

    return response.ok && empty
      ? new Response('null', {
          status: 200,
          statusText: response.statusText,
          headers: response.headers,
        })
      : response;
  };
}
