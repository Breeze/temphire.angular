import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  configureBreeze,
  DataService,
  EntityManager,
  EntityQuery,
  type BreezeFetch,
} from 'breeze-client';
import { httpClientFetch } from 'breeze-client/adapter-angular-httpclient';

import { emptyBodyAsNull } from './breeze-fetch';

/**
 * Pins down the breeze-client 3.0.0 empty-body bug and the workaround for it.  See
 * `breeze-fetch.ts`.  The queries run through Breeze's real request pipeline; only the network is
 * replaced, by handing Breeze a fetch function that returns a canned response.
 */
describe('emptyBodyAsNull (breeze-client 3.0.0 workaround)', () => {
  const respondWith =
    (response: () => Response): BreezeFetch =>
    async () =>
      response();

  const noContent = () => new Response(null, { status: 204 });
  const emptyOk = () => new Response('', { status: 200, headers: { 'content-length': '0' } });

  function query() {
    // `hasServerMetadata: false` lets the query run without a metadata round trip.
    const dataService = new DataService({
      serviceName: 'http://localhost/api/breeze',
      hasServerMetadata: false,
    });
    const manager = new EntityManager({ dataService });
    return manager.executeQuery(EntityQuery.from('StaffingResources'));
  }

  afterEach(() => configureBreeze({ fetch: (input, init) => globalThis.fetch(input, init) }));

  // This is the bug.  When a breeze-client release with the fix is installed, this test fails:
  // that is the signal to delete the workaround (see breeze-fetch.ts).
  it('without the workaround, a 204 fails the query', async () => {
    configureBreeze({ fetch: respondWith(noContent) });

    await expect(query()).rejects.toMatchObject({
      status: 204,
      statusText: expect.stringMatching(/^Unable to read the response body/),
    });
  });

  it('reads a 204 No Content as no results', async () => {
    configureBreeze({ fetch: emptyBodyAsNull(respondWith(noContent)) });

    const data = await query();

    expect(data.results).toEqual([]);
  });

  it('reads a 200 with an empty body as no results', async () => {
    configureBreeze({ fetch: emptyBodyAsNull(respondWith(emptyOk)) });

    const data = await query();

    expect(data.results).toEqual([]);
  });

  it('still fails on a body that is not JSON', async () => {
    const htmlPage = () =>
      new Response('<html>proxy login</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    configureBreeze({ fetch: emptyBodyAsNull(respondWith(htmlPage)) });

    await expect(query()).rejects.toThrow();
  });

  // The path the app uses: Breeze -> httpClientFetch -> HttpClient (see app.config.ts).
  it('reads a 204 No Content through HttpClient as no results', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const httpTesting = TestBed.inject(HttpTestingController);
    configureBreeze({ fetch: emptyBodyAsNull(httpClientFetch(TestBed.inject(HttpClient))) });

    const pending = query();
    const request = await vi.waitFor(() =>
      httpTesting.expectOne((req) =>
        req.url.startsWith('http://localhost/api/breeze/StaffingResources'),
      ),
    );
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect((await pending).results).toEqual([]);
    httpTesting.verify();
  });

  it('passes error responses through unchanged', async () => {
    const notFound = new Response(null, { status: 404 });
    const fetchFn = emptyBodyAsNull(async () => notFound);

    expect(await fetchFn('http://localhost/api/breeze/StaffingResources')).toBe(notFound);
  });
});
