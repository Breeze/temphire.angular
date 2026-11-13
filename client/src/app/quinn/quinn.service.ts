import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from '../core/services/auth.service';
import { AppErrorHandler } from '../core/services/error-handler.service';

/** One message in the conversation.  `content` is Markdown. */
export interface QuinnMessage {
  readonly id: number;
  readonly role: 'user' | 'assistant' | 'error';
  readonly content: string;
  /** Quinn's introduction: shown, but not sent to the server as part of the conversation. */
  readonly intro?: boolean;
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

  /** Quinn's name and model, loaded once from the server. */
  readonly info = httpResource<AgentInfo>(() => `${environment.agentApiRoot}/info`);

  readonly companyName = computed(
    () => this.auth.tenantName() ?? (this.info.hasValue() ? this.info.value().companyName : null),
  );

  open(): void {
    // The first time the pane opens, Quinn introduces themselves.
    if (this._messages().length === 0) {
      this.add('assistant', this.introduction(), true);
    }
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  /** Sends a question and adds Quinn's answer, or an error message. */
  async ask(question: string): Promise<void> {
    const text = question.trim();
    if (!text || this.busy()) {
      return;
    }

    this.add('user', text);
    this.busy.set(true);

    try {
      const conversation = this._messages()
        .filter((m) => !m.intro && m.role !== 'error')
        .map(({ role, content }) => ({ role, content }));

      const reply = await firstValueFrom(
        this.http.post<{ content: string }>(`${environment.agentApiRoot}/chat`, {
          messages: conversation,
        }),
      );
      this.add('assistant', reply.content?.trim() || "Sorry, I don't have an answer for that.");
    } catch (error) {
      this.add('error', AppErrorHandler.describe(error).detail);
    } finally {
      this.busy.set(false);
    }
  }

  private add(role: QuinnMessage['role'], content: string, intro = false): void {
    this._messages.update((messages) => [...messages, { id: this.nextId++, role, content, intro }]);
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
