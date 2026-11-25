import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../environments/environment';
import { AuthService } from '../core/services/auth.service';
import { QuinnService } from './quinn.service';

@Component({ template: '' })
class PageStub {}

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
        provideRouter([
          { path: 'home', component: PageStub },
          { path: 'resourcemgt', component: PageStub },
        ]),
        {
          provide: AuthService,
          useValue: { username: signal('anna@harbor.test'), tenantName: signal('Harbor Staffing') },
        },
      ],
    });
    quinn = TestBed.inject(QuinnService);
    http = TestBed.inject(HttpTestingController);
  });

  it('closes the pane whenever the route changes', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/home');

    quinn.open();
    await router.navigateByUrl('/resourcemgt');
    expect(quinn.isOpen()).toBe(false);

    // A person link from an answer only changes the query.
    quinn.open();
    await router.navigateByUrl('/resourcemgt?resource=m1');
    expect(quinn.isOpen()).toBe(false);
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

  describe('questions from a tool', () => {
    const choices = [
      { value: 'home', label: 'Home Address: 1 Main St, Seattle, WA 98101' },
      { value: 'work', label: 'Work Address: 200 Pine St, Portland, OR 97204' },
    ];

    /** Starts a question and streams the given updates, leaving the answer open. */
    function start(...updates: object[]) {
      const answered = quinn.ask("Change Ann Lee's address to 12 Elm St, Tacoma");
      const chat = http.expectOne(`${environment.agentApiRoot}/chat`);
      const text = stream(...updates);
      chat.event({ type: HttpEventType.DownloadProgress, loaded: text.length, partialText: text });
      return { answered, finish: (...more: object[]) => chat.flush(text + stream(...more)) };
    }

    const question = () => quinn.messages().find((m) => m.question)!;

    it('shows a choice, and sends the choice the user makes to the tool', async () => {
      const { answered, finish } = start(
        { type: 'text', content: 'Let me check.' },
        { type: 'input', id: 'q1', content: '**Ann Lee** has 2 addresses. Which one?', choices },
      );

      expect(question()).toEqual(
        expect.objectContaining({
          content: '**Ann Lee** has 2 addresses. Which one?',
          question: { id: 'q1', choices, state: 'open' },
        }),
      );
      // Waiting for the user, not for the model.
      expect(quinn.thinking()).toBe(false);

      // OK needs a choice first.
      await quinn.answer(question().id, true);
      http.expectNone(`${environment.agentApiRoot}/answer`);

      quinn.select(question().id, 'work');
      const sent = quinn.answer(question().id, true);
      const answer = http.expectOne(`${environment.agentApiRoot}/answer`);
      expect(answer.request.body).toEqual({ id: 'q1', accept: true, choice: 'work' });
      expect(question().question?.state).toBe('sending');
      answer.flush(null);
      await sent;

      expect(question().question).toEqual(
        expect.objectContaining({ state: 'accepted', selected: 'work' }),
      );
      expect(quinn.thinking()).toBe(true);

      finish({ type: 'text', content: 'Now the new address.' }, { type: 'done' });
      await answered;

      // The text before the question, the question, and the text after it, in that order.
      expect(
        quinn
          .messages()
          .filter((m) => m.role === 'assistant')
          .map((m) => m.content),
      ).toEqual([
        'Let me check.',
        '**Ann Lee** has 2 addresses. Which one?',
        'Now the new address.',
      ]);
    });

    it('sends a confirmation or a cancellation, without a choice', async () => {
      const { answered, finish } = start({
        type: 'input',
        id: 'q2',
        content: 'Update **Ann Lee**?',
      });

      const sent = quinn.answer(question().id, false);
      const answer = http.expectOne(`${environment.agentApiRoot}/answer`);
      expect(answer.request.body).toEqual({ id: 'q2', accept: false, choice: undefined });
      answer.flush(null);
      await sent;
      expect(question().question?.state).toBe('cancelled');

      finish({ type: 'text', content: 'Nothing was changed.' }, { type: 'done' });
      await answered;
    });

    it('closes a question that can no longer be answered', async () => {
      const { answered, finish } = start({
        type: 'input',
        id: 'q3',
        content: 'Update **Ann Lee**?',
      });

      finish(
        { type: 'inputClosed', id: 'q3' },
        { type: 'text', content: 'Nothing was changed.' },
        { type: 'done' },
      );
      await answered;

      expect(question().question?.state).toBe('closed');
      await quinn.answer(question().id, true);
      http.expectNone(`${environment.agentApiRoot}/answer`);
    });

    it('leaves the questions out of the conversation it sends', async () => {
      const { answered, finish } = start({
        type: 'input',
        id: 'q4',
        content: 'Update **Ann Lee**?',
      });
      finish(
        { type: 'inputClosed', id: 'q4' },
        { type: 'text', content: 'Nothing was changed.' },
        { type: 'done' },
      );
      await answered;

      const next = quinn.ask('Thanks');
      const chat = http.expectOne(`${environment.agentApiRoot}/chat`);
      expect(chat.request.body.messages).toEqual([
        { role: 'user', content: "Change Ann Lee's address to 12 Elm St, Tacoma" },
        { role: 'assistant', content: 'Nothing was changed.' },
        { role: 'user', content: 'Thanks' },
      ]);
      chat.flush(stream({ type: 'text', content: 'You are welcome.' }, { type: 'done' }));
      await next;
    });
  });
});
