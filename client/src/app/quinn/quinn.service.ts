import { HttpClient, HttpErrorResponse, HttpEventType, httpResource } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, lastValueFrom, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from '../core/services/auth.service';
import { AppErrorHandler } from '../core/services/error-handler.service';
import { EventAggregator } from '../core/services/event-aggregator';
import { UsageDto, quotaBlock, quotaBlockMessage } from '../usage/usage.model';
import { MentionedPerson, mergePeople } from './link-people';

/** One message in the conversation.  `content` is Markdown, as Quinn wrote it. */
export interface QuinnMessage {
  readonly id: number;
  readonly role: 'user' | 'assistant' | 'error';
  readonly content: string;
  /** Quinn's introduction: shown, but not sent to the server as part of the conversation. */
  readonly intro?: boolean;
  /** An answer still streaming in. */
  readonly streaming?: boolean;
  /**
   * The people an answer can mention, from the server.  Their names are linked to their records
   * when the answer is shown (see `LinkPeoplePipe`); `content` itself stays as Quinn wrote it.
   */
  readonly people?: readonly MentionedPerson[];
  /**
   * A question a tool asks the user while Quinn answers, such as which address to change or
   * whether to save the change.  `content` is the question; the pane adds the choices and the
   * buttons.  Not sent to the server as part of the conversation: the answer goes to the tool.
   */
  readonly question?: QuinnQuestion;
  /**
   * For an answer: what its tools saved, one sentence each, from the stream's `saved` lines.  Sent
   * back with the answer: the server sends the model earlier answers without their tool calls, and
   * without this the model doubted, and took back, a change it had made.
   */
  readonly saved?: readonly string[];
}

/**
 * A question from a tool (MCP elicitation, see `QuinnAgent` on the server): pick one of the
 * choices and OK, or with no choices, Confirm; or Cancel.  The answer goes to
 * `api/agent/answer`, and from there to the tool, not to the model.
 */
export interface QuinnQuestion {
  readonly id: string;
  /** The choices, as radio buttons; none for a confirmation. */
  readonly choices?: readonly QuinnChoice[];
  /** The choice selected so far, and then the one answered with. */
  readonly selected?: string;
  /**
   * `open` until answered; `sending` while the answer is on its way; then `accepted` (OK or
   * Confirm) or `cancelled`; or `closed` if it can no longer be answered (it timed out, or the
   * answer ended).
   */
  readonly state: 'open' | 'sending' | 'accepted' | 'cancelled' | 'closed';
}

/** One choice of a question: the value to answer with, and what the user sees. */
export interface QuinnChoice {
  readonly value: string;
  readonly label: string;
}

/** One line of the streamed answer from `api/agent/chat`. */
interface QuinnUpdate {
  readonly type: 'text' | 'people' | 'input' | 'inputClosed' | 'saved' | 'done' | 'error';
  readonly content?: string;
  readonly people?: readonly MentionedPerson[];
  /** The question's id, for `input` and `inputClosed`. */
  readonly id?: string;
  readonly choices?: readonly QuinnChoice[];
  /** What a tool saved, for `saved`. */
  readonly changes?: readonly SavedChange[];
}

/** An entity a tool saved, such as the address Quinn changed, and its staffing resource. */
interface SavedChange {
  readonly entityType: string;
  readonly id: string;
  readonly staffingResourceId: string;
  /** What was done, in a sentence: kept with the answer (`QuinnMessage.saved`). */
  readonly summary?: string;
}

/** An example question offered under the introduction. */
export interface ExampleQuestion {
  readonly label: string;
  readonly question: string;
}

/** `GET api/agent/info`: who answers. */
export interface AgentInfo {
  name: string;
  model: string;
  companyName: string;
}

export const EXAMPLE_QUESTIONS: readonly ExampleQuestion[] = [
  { label: 'Who knows SQL?', question: 'Who knows SQL?' },
  {
    label: 'How many people in each state?',
    question: 'How many staffing resources do we have in each state?',
  },
  { label: 'Average hourly rate per skill', question: "What's the average hourly rate per skill?" },
  { label: 'Who has the highest hourly rate?', question: 'Who has the highest hourly rate?' },
  { label: 'Who has been a project manager?', question: 'Who has worked as a project manager?' },
  { label: 'Ask me about my name', question: 'Tell me about your name. Where does it come from?' },
];

/**
 * The conversation with Quinn.
 *
 * Provided by `QuinnComponent`, not in root: the component exists only while someone is signed in,
 * so signing out throws the conversation away with it, and the next user starts fresh.
 *
 * The agent runs on the server (`AgentController`).  This sends the conversation so far and adds
 * Quinn's answer; the server keeps no chat state.
 *
 * The pane closes whenever the route changes - a link in an answer, the toolbar, the browser's
 * back button - so it never covers the page the user just went to.
 */
@Injectable()
export class QuinnService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly events = inject(EventAggregator);

  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.close());

    const clock = setInterval(() => this.tick(), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
  }

  private nextId = 1;
  private readonly _messages = signal<readonly QuinnMessage[]>([]);

  /**
   * Everyone the answers so far could mention.  A follow-up answer often names people from an
   * earlier one ("What other skills do they have?") without the tools returning them again, so
   * each answer is linked with these as well as its own.
   */
  private knownPeople: readonly MentionedPerson[] = [];

  readonly messages = this._messages.asReadonly();
  readonly isOpen = signal(false);
  readonly busy = signal(false);

  /**
   * Busy, no answer streaming in yet, and no question waiting for the user: the model is still
   * thinking or running tools.
   */
  readonly thinking = computed(
    () =>
      this.busy() &&
      !this._messages().some(
        (m) => m.streaming || m.question?.state === 'open' || m.question?.state === 'sending',
      ),
  );

  /** Quinn's name and model, loaded once from the server. */
  readonly info = httpResource<AgentInfo>(() => `${environment.agentApiRoot}/info`);

  // ------------------------------------------------------------------------------------------
  // Quotas
  //
  // The server refuses a question while a quota of the model Quinn uses is used up (429, with a
  // message saying which and for how long).  The pane says so before the user asks: it reads the
  // usage when it opens and after every answer, and while a quota stops Quinn it disables the
  // question box and counts down to the moment the quota starts over.
  // ------------------------------------------------------------------------------------------

  /** Set once the pane has opened: the usage is read only for users who use Quinn. */
  private readonly usageWanted = signal(false);

  /** `GET api/usage`: the user's and company's usage and quotas, per model. */
  readonly usage = httpResource<UsageDto>(() =>
    this.usageWanted() ? environment.usageApiRoot : undefined,
  );

  /** The time, updated every half minute: for the countdown, and to notice a quota starting over. */
  private readonly now = signal(new Date());

  /** The used-up quota that stops Quinn now, if any. */
  readonly quotaBlock = computed(() =>
    quotaBlock(this.usage.hasValue() ? this.usage.value() : undefined, this.now()),
  );

  /** What the pane says while a quota stops Quinn, with how long until it starts over. */
  readonly quotaMessage = computed(() => {
    const block = this.quotaBlock();
    return block ? quotaBlockMessage(block, this.now()) : null;
  });

  /** Ticks the clock, and reads the usage again once a blocking quota has started over. */
  private tick(): void {
    const block = this.quotaBlock();
    this.now.set(new Date());
    if (block && this.now() >= block.resetsAt) {
      this.usage.reload();
    }
  }

  readonly companyName = computed(
    () => this.auth.tenantName() ?? (this.info.hasValue() ? this.info.value().companyName : null),
  );

  open(): void {
    // The first time the pane opens, Quinn introduces themselves.
    if (this._messages().length === 0) {
      this.add('assistant', this.introduction(), { intro: true });
    }

    // Where the quotas stand: read the first time, and again each time the pane opens, since the
    // user may have asked elsewhere - another tab - meanwhile.
    if (this.usageWanted()) {
      this.usage.reload();
    } else {
      this.usageWanted.set(true);
    }
    this.now.set(new Date());
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  /**
   * Sends a question and adds Quinn's answer as it streams in, or an error message.
   *
   * The server answers with one JSON object per line (see `AgentController.Chat`): `text` pieces
   * as the model writes them, the `people` the answer can mention as the tools return them, and
   * `done` at the end.  The pieces grow the answer as they arrive; the people go with it, so their
   * names become links as soon as they appear.  A tool may ask the user something on the way
   * (`input`): it becomes a message of its own, with the question, and the text after it a new
   * message below it, once the user has answered (see `answer`).  When a tool has saved a change
   * (`saved`), it is announced as a save (`EventAggregator.savedElsewhere`), so the screens that
   * show the changed data refresh it.  `HttpClient` reports the response so far with each
   * download progress event, so the lines are read from that, which keeps the request going
   * through the interceptors like any other.
   */
  async ask(question: string): Promise<void> {
    const text = question.trim();
    if (!text || this.busy() || this.quotaBlock()) {
      return;
    }

    this.add('user', text);
    this.busy.set(true);

    let answerId: number | undefined;
    // The people this answer can mention: those from earlier answers, plus those the tools return
    // now.  They usually arrive before the first text, when there is no answer to attach them to yet.
    let people = this.knownPeople;
    let received = 0;
    let pending = '';
    // Whether a tool asked the user something: then an answer without text of its own is fine.
    let asked = false;
    // What the tools saved, kept with the answer once it is complete.
    const saved: string[] = [];
    const firstOfAnswer = this.nextId;

    const handle = (line: string) => {
      if (!line.trim()) {
        return;
      }
      const update = JSON.parse(line) as QuinnUpdate;

      if (update.type === 'text') {
        if (answerId === undefined) {
          answerId = this.add('assistant', update.content ?? '', { streaming: true, people });
        } else {
          this.change(answerId, (m) => ({ ...m, content: m.content + (update.content ?? '') }));
        }
      } else if (update.type === 'people') {
        people = mergePeople(this.knownPeople, update.people ?? []);
        if (answerId !== undefined) {
          this.change(answerId, (m) => ({ ...m, people }));
        }
      } else if (update.type === 'input' && update.id) {
        // The text so far is complete; what Quinn writes after the user answers goes below the question.
        if (answerId !== undefined) {
          this.change(answerId, (m) => ({ ...m, content: m.content.trim(), streaming: false }));
          answerId = undefined;
        }
        asked = true;
        this.add('assistant', update.content ?? '', {
          people,
          question: { id: update.id, choices: update.choices, state: 'open' },
        });
      } else if (update.type === 'inputClosed') {
        this.closeQuestions((q) => q.id === update.id);
      } else if (update.type === 'saved') {
        saved.push(...(update.changes ?? []).flatMap((c) => (c.summary ? [c.summary] : [])));
        // A tool saved a change, such as an address: the screens that show it refresh it.
        this.events.savedElsewhere({
          by: 'Quinn',
          staffingResourceIds: [
            ...new Set((update.changes ?? []).map((c) => c.staffingResourceId)),
          ],
        });
      } else if (update.type === 'done') {
        if (answerId === undefined && asked) {
          // Nothing more to say.
        } else if (answerId === undefined) {
          answerId = this.add('assistant', "Sorry, I don't have an answer for that.");
        } else {
          this.change(answerId, (m) => ({ ...m, content: m.content.trim(), streaming: false }));
        }
      } else if (update.type === 'error') {
        this.discard(answerId);
        answerId = undefined;
        this.add('error', update.content ?? 'Quinn ran into a problem answering that.');
      }
    };

    // The response so far, each time a little longer: handle the lines completed since last time.
    const read = (responseSoFar: string) => {
      pending += responseSoFar.slice(received);
      received = responseSoFar.length;
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      lines.forEach(handle);
    };

    try {
      const conversation = this._messages()
        .filter((m) => !m.intro && !m.question && m.role !== 'error')
        .map(({ role, content, saved }) => (saved ? { role, content, saved } : { role, content }));

      await lastValueFrom(
        this.http
          .post(
            `${environment.agentApiRoot}/chat`,
            { messages: conversation },
            { observe: 'events', reportDownloadProgress: true, responseType: 'text' },
          )
          .pipe(
            tap((event) => {
              if (event.type === HttpEventType.DownloadProgress) {
                read(event.partialText ?? '');
              } else if (event.type === HttpEventType.Response) {
                read(event.body ?? '');
              }
            }),
          ),
      );
      handle(pending);
    } catch (error) {
      this.discard(answerId);
      this.add('error', AppErrorHandler.describe(error).detail);
    } finally {
      // A stream cut off before `done` leaves the text so far; stop showing it as in progress.
      if (answerId !== undefined) {
        this.change(answerId, (m) => ({ ...m, streaming: false }));
      }
      // A question still waiting can't be answered once the answer has ended.
      this.closeQuestions(() => true);
      this.keepSaved(firstOfAnswer, saved);
      this.knownPeople = people;
      this.busy.set(false);

      // The answer used tokens, and may have used up a quota; a refusal (429) means one is.
      if (this.usageWanted()) {
        this.usage.reload();
      }
    }
  }

  /** Selects one of a question's choices, before OK. */
  select(messageId: number, value: string): void {
    this.changeQuestion(messageId, (q) => (q.state === 'open' ? { ...q, selected: value } : q));
  }

  /**
   * Answers a question: OK (with the selected choice) or Confirm when `accept`, otherwise Cancel.
   * The answer goes to the tool that asked; Quinn's answer then goes on in the stream.  A question
   * that can no longer be answered (404) is shown as closed.
   */
  async answer(messageId: number, accept: boolean): Promise<void> {
    const question = this._messages().find((m) => m.id === messageId)?.question;
    if (
      !question ||
      question.state !== 'open' ||
      (accept && question.choices?.length && !question.selected)
    ) {
      return;
    }

    this.changeQuestion(messageId, (q) => ({ ...q, state: 'sending' }));
    try {
      await lastValueFrom(
        this.http.post(`${environment.agentApiRoot}/answer`, {
          id: question.id,
          accept,
          choice: accept ? question.selected : undefined,
        }),
      );
      this.changeQuestion(messageId, (q) => ({ ...q, state: accept ? 'accepted' : 'cancelled' }));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.changeQuestion(messageId, (q) => ({ ...q, state: 'closed' }));
      } else {
        this.changeQuestion(messageId, (q) => ({ ...q, state: 'open' }));
        this.add('error', AppErrorHandler.describe(error).detail);
      }
    }
  }

  /**
   * Keeps what the tools saved with the answer: on its last message of text, the one the
   * conversation sends back (questions aren't sent).
   */
  private keepSaved(firstOfAnswer: number, saved: readonly string[]): void {
    const answer = this._messages()
      .filter((m) => m.id >= firstOfAnswer && m.role === 'assistant' && !m.question)
      .at(-1);
    if (saved.length > 0 && answer) {
      this.change(answer.id, (m) => ({ ...m, saved: [...(m.saved ?? []), ...saved] }));
    }
  }

  /** Marks the questions still waiting for the user that match as closed. */
  private closeQuestions(matches: (question: QuinnQuestion) => boolean): void {
    this._messages.update((messages) =>
      messages.map((m) =>
        m.question &&
        (m.question.state === 'open' || m.question.state === 'sending') &&
        matches(m.question)
          ? { ...m, question: { ...m.question, state: 'closed' } }
          : m,
      ),
    );
  }

  private changeQuestion(
    messageId: number,
    update: (question: QuinnQuestion) => QuinnQuestion,
  ): void {
    this.change(messageId, (m) => (m.question ? { ...m, question: update(m.question) } : m));
  }

  private add(
    role: QuinnMessage['role'],
    content: string,
    flags: Pick<QuinnMessage, 'intro' | 'streaming' | 'people' | 'question'> = {},
  ): number {
    const id = this.nextId++;
    this._messages.update((messages) => [...messages, { id, role, content, ...flags }]);
    return id;
  }

  private change(id: number, update: (message: QuinnMessage) => QuinnMessage): void {
    this._messages.update((messages) => messages.map((m) => (m.id === id ? update(m) : m)));
  }

  private discard(id: number | undefined): void {
    if (id !== undefined) {
      this._messages.update((messages) => messages.filter((m) => m.id !== id));
    }
  }

  private introduction(): string {
    const name = this.auth.username() ?? '';
    const first = name.split('@')[0];
    const greeting = first ? `Hi ${first.charAt(0).toUpperCase()}${first.slice(1)}!` : 'Hi!';
    const company = this.companyName() ?? 'your company';

    return (
      `${greeting} I'm **Quinn**, your TempHire assistant.\n\n` +
      `I can look things up in **${company}**'s staffing data for you: who has which skills, ` +
      `where people are based, their rates and their work history. Try one of these, or ask me anything.\n\n` +
      `Curious where my name comes from? *Ask me about my name.*`
    );
  }
}
