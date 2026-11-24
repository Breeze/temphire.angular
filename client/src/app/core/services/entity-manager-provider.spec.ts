import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureBreeze } from 'breeze-client';
import { ValidationService, createValidationService } from 'ideablade-validation';
import { vi } from 'vitest';

import metadata from '../../../../metadata.json';
import { EntityManagerProvider } from './entity-manager-provider';

/**
 * `prepare` loads Breeze's metadata, the validation metadata and the lookups; after a `reset` it
 * loads the lookups again, and each kind of metadata only if it didn't load before.
 *
 * Neither kind of metadata may load twice: the store would refuse Breeze's (and the entity classes
 * can't move to another store), and the validation service would hold every server rule twice.
 * And nothing retries a failed `prepare` until a `reset`.
 *
 * Both Breeze and `HttpClient` (`withFetch`) go through the global `fetch`, which stands in for
 * the server here.
 */
describe('EntityManagerProvider', () => {
  const failing = { breeze: false, validation: false };
  const requests: string[] = [];
  const requestsTo = (path: string) => requests.filter((url) => url.includes(path)).length;

  // A model type only the server's validation metadata has: how often it was added shows up in
  // its configs.
  const serverRules = { ServerOnly: { properties: {} } };

  const fakeServer = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requests.push(url);
    if (url.includes('/model/Metadata')) {
      return failing.breeze ? new Response('down', { status: 503 }) : Response.json(metadata);
    }
    if (url.includes('/validation/Metadata')) {
      return failing.validation ? new Response('down', { status: 503 }) : Response.json(serverRules);
    }
    if (url.includes('/lookups/AllTypes')) {
      return Response.json([]);
    }
    return new Response('not found', { status: 404 });
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', fakeServer);
    configureBreeze({ fetch: (input, init) => fakeServer(input, init) });
  });

  afterEach(() => vi.unstubAllGlobals());

  // One test for the whole sequence: Breeze binds the entity classes to the first store they are
  // registered with, so only one provider in this file may get as far as registering them.
  it('loads what failed after a reset, and never loads the metadata twice', async () => {
    const validation = createValidationService();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withFetch()),
        { provide: ValidationService, useValue: validation },
      ],
    });
    const provider = TestBed.inject(EntityManagerProvider);
    const store = provider.metadataStore;
    const serverRuleSets = () => validation.validationMetadata.getModelMetadata('ServerOnly').configs.length;

    // Breeze's metadata fails: the attempt fails, and nothing retries it.
    failing.breeze = true;
    const failed = provider.prepare();
    await expect(failed).rejects.toBeDefined();
    expect(provider.prepare()).toBe(failed);
    expect(requestsTo('/model/Metadata')).toBe(1);
    expect(serverRuleSets()).toBe(0);

    // After a reset Breeze's loads, but the validation metadata fails.
    failing.breeze = false;
    failing.validation = true;
    provider.reset();
    await expect(provider.prepare()).rejects.toBeDefined();
    expect(requestsTo('/model/Metadata')).toBe(2);
    expect(serverRuleSets()).toBe(0);

    // After the next reset only the validation metadata is fetched again, and then the lookups.
    failing.validation = false;
    provider.reset();
    await provider.prepare();
    expect(provider.isPrepared).toBe(true);
    expect(requestsTo('/model/Metadata')).toBe(2);
    expect(requestsTo('/validation/Metadata')).toBe(3);
    expect(requestsTo('/lookups/AllTypes')).toBe(1);
    expect(serverRuleSets()).toBe(1);

    // A reset after a sign-in that worked loads only the lookups again.
    provider.reset();
    expect(provider.isPrepared).toBe(false);
    await provider.prepare();
    expect(provider.isPrepared).toBe(true);
    expect(requestsTo('/model/Metadata')).toBe(2);
    expect(requestsTo('/validation/Metadata')).toBe(3);
    expect(requestsTo('/lookups/AllTypes')).toBe(2);
    expect(serverRuleSets()).toBe(1);
    expect(provider.metadataStore).toBe(store);
    expect(() => provider.newManager('/api/resourcemgt')).not.toThrow();
  });
});
