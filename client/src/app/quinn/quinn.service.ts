import { HttpClient, HttpEventType, httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { lastValueFrom, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from '../core/services/auth.service';
import { AppErrorHandler } from '../core/services/error-handler.service';
import { MentionedPerson } from './link-people';

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
}

/** One line of the streamed answer from `api/agent/chat`. */
interface QuinnUpdate {
  readonly type: 'text' | 'people' | 'done' | 'error';
  readonly content?: string;
  readonly people?: readonly MentionedPerson[];
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
 */
@Injectable()
export class QuinnService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private nextId = 1;
  private readonly _messages = signal<readonly QuinnMessage[]>([]);

  readonly messages = this._messages.asReadonly();
  readonly isOpen = signal(false);
  readonly busy = signal(false);

  /** Busy, and no answer streaming in yet: the model is still thinking or running tools. */
  readonly thinking = computed(() => this.busy() && !this._messages().some((m) => m.streaming));

  /** Quinn's name and model, loaded once from the server. */
  readonly info = httpResource<AgentInfo>(() => `${environment.agentApiRoot}/info`);

  readonly companyName = computed(
    () => this.auth.tenantName() ?? (this.info.hasValue() ? this.info.value().companyName : null),
  );

  open(): void {
    // The first time the pane opens, Quinn introduces themselves.
    if (this._messages().length === 0) {
      this.add('assistant', this.introduction(), { intro: true });
    }
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
   * names become links as soon as they appear.  `HttpClient` reports the response so far with each
   * download progress event, so the lines are read from that, which keeps the request going
   * through the interceptors like any other.
   */
  async ask(question: string): Promise<void> {
    const text = question.trim();
    if (!text || this.busy()) {
      return;
    }

    this.add('user', text);
    this.busy.set(true);

    let answerId: number | undefined;
    // The people usually arrive before the first text, when there is no answer to attach them to yet.
    let people: readonly MentionedPerson[] = [];
    let received = 0;
    let pending = '';

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
        people = update.people ?? [];
        if (answerId !== undefined) {
          this.change(answerId, (m) => ({ ...m, people }));
        }
      } else if (update.type === 'done') {
        if (answerId === undefined) {
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
        .filter((m) => !m.intro && m.role !== 'error')
        .map(({ role, content }) => ({ role, content }));

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
      this.busy.set(false);
    }
  }

  private add(
    role: QuinnMessage['role'],
    content: string,
    flags: Pick<QuinnMessage, 'intro' | 'streaming' | 'people'> = {},
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
