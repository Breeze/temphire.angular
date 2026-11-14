import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { AuthService } from '../core/services/auth.service';
import { QuinnService } from './quinn.service';

describe('QuinnService', () => {
  let quinn: QuinnService;
  let http: HttpTestingController;

  /** A streamed answer, as `api/agent/chat` sends it: one JSON object per line. */
  const stream = (...updates: object[]) => updates.map((u) => JSON.stringify(u)).join('\n') + '\n';

  async function ask(question: string, response: string): Promise<void> {
    const answered = quinn.ask(question);
    http.expectOne(`${environment.agentApiRoot}/chat`).flush(response);
    await answered;
  }

  const lastAnswer = () =>
    quinn
      .messages()
      .filter((m) => m.role === 'assistant')
      .at(-1)!;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        QuinnService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { username: signal('anna@harbor.test'), tenantName: signal('Harbor Staffing') },
        },
      ],
    });
    quinn = TestBed.inject(QuinnService);
    http = TestBed.inject(HttpTestingController);
  });

  it('streams the text of an answer, with the people it can mention', async () => {
    await ask(
      'Who knows SQL?',
      stream(
        { type: 'people', people: [{ name: 'Mia I Gallagher', id: 'm1' }] },
        { type: 'text', content: 'Mia I Gall' },
        { type: 'text', content: 'agher knows SQL.' },
        { type: 'done' },
      ),
    );

    expect(lastAnswer()).toEqual(
      expect.objectContaining({
        content: 'Mia I Gallagher knows SQL.',
        streaming: false,
        people: [{ name: 'Mia I Gallagher', id: 'm1' }],
      }),
    );
  });

  // A follow-up answer names people from an earlier one without the tools returning them again.
  it('keeps the people from earlier answers for follow-up questions', async () => {
    await ask(
      'Who knows SQL?',
      stream(
        { type: 'people', people: [{ name: 'Mia I Gallagher', id: 'm1' }] },
        { type: 'text', content: 'Mia I Gallagher knows SQL.' },
        { type: 'done' },
      ),
    );

    await ask(
      'What other skills do they have?',
      stream(
        { type: 'people', people: [{ name: 'Yasmin S Kowalski', id: 'y1' }] },
        { type: 'text', content: 'Yasmin S Kowalski: Agile. Mia I Gallagher: Power BI.' },
        { type: 'done' },
      ),
    );

    expect(lastAnswer().people).toEqual([
      { name: 'Mia I Gallagher', id: 'm1' },
      { name: 'Yasmin S Kowalski', id: 'y1' },
    ]);
  });

  it('links earlier people even when a follow-up calls no tools at all', async () => {
    await ask(
      'Who knows SQL?',
      stream(
        { type: 'people', people: [{ name: 'Mia I Gallagher', id: 'm1' }] },
        { type: 'text', content: 'Mia I Gallagher knows SQL.' },
        { type: 'done' },
      ),
    );

    await ask(
      'Where is she based?',
      stream({ type: 'text', content: 'Mia I Gallagher is in Boston.' }, { type: 'done' }),
    );

    expect(lastAnswer().people).toEqual([{ name: 'Mia I Gallagher', id: 'm1' }]);
  });
});
