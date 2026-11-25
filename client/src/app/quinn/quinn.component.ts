import { Component, ElementRef, afterRenderEffect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormRoot, disabled, form } from '@angular/forms/signals';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { TextareaModule } from '@openng/optimus-ui/textarea';

import { LinkPeoplePipe } from './link-people.pipe';
import { MarkdownPipe } from './markdown.pipe';
import { QuinnLogoComponent } from './quinn-logo.component';
import { EXAMPLE_QUESTIONS, QuinnService } from './quinn.service';

/**
 * Quinn, the TempHire assistant: a round launcher button in the bottom right corner, and a chat
 * pane that slides in from the right.
 *
 * The first time the pane opens, Quinn introduces themselves and offers example questions; a click
 * on one asks it.  Answers arrive as Markdown and are rendered with the `markdown` pipe.
 *
 * The people an answer mentions become links to their records (`LinkPeoplePipe`, from the people
 * the server reports for that answer).  Clicks on links are handled here: a link into the app
 * closes the pane and navigates there; any other link opens in a new tab, so the app is never
 * left by accident.
 *
 * Rendered by the shell only while someone is signed in, and it provides its own `QuinnService`,
 * so the conversation is discarded on sign-out.
 */
@Component({
  selector: 'app-quinn',
  imports: [
    FormRoot,
    ButtonDirective,
    TextareaModule,
    LinkPeoplePipe,
    MarkdownPipe,
    QuinnLogoComponent,
  ],
  providers: [QuinnService],
  host: { '(document:keydown.escape)': 'quinn.close()' },
  templateUrl: './quinn.component.html',
  styleUrl: './quinn.component.css',
})
export class QuinnComponent {
  protected readonly quinn = inject(QuinnService);
  protected readonly examples = EXAMPLE_QUESTIONS;
  private readonly router = inject(Router);

  private readonly messageList = viewChild.required<ElementRef<HTMLElement>>('messageList');
  private readonly questionBox = viewChild.required<ElementRef<HTMLTextAreaElement>>('questionBox');

  /**
   * The question box: a Signal Form, disabled while Quinn is answering, and while a used-up quota
   * stops Quinn from answering at all.
   *
   * The textarea is bound to the field by hand rather than with `[formField]`, because Optimus UI
   * 2.0.2's `pTextarea` cannot sit next to `[formField]`: it subscribes to the `valueChanges` of the
   * element's `NgControl`, and the one Signal Forms provides has none, so it throws on init.  Once
   * Optimus UI handles Signal Forms there, go back to `[formField]="questionForm.question"` and
   * drop the extra clearing in the submit action.
   *
   * Reported as https://github.com/openng-org/optimus-ui/issues/203, with a fix pending in
   * https://github.com/openng-org/optimus-ui/pull/1956.
   */
  protected readonly questionForm = form(
    signal({ question: '' }),
    (path) => disabled(path.question, { when: () => this.quinn.busy() || !!this.quinn.quotaBlock() }),
    {
      submission: {
        action: async (field) => {
          const question = field.question().value();
          field.question().value.set('');
          // Also clear the element itself: when Enter follows the last keystroke before the view
          // has re-rendered, the `[value]` binding never saw the text, so '' would not count as a
          // change and the question would stay in the box.
          this.questionBox().nativeElement.value = '';
          await this.quinn.ask(question);
        },
      },
    },
  );

  constructor() {
    // Keep the newest message in view.  An effect that runs after rendering, because the scroll
    // height is only known once the new message is in the DOM.
    afterRenderEffect(() => {
      this.quinn.messages();
      this.quinn.busy();
      const list = this.messageList().nativeElement;
      list.scrollTop = list.scrollHeight;
    });

    // The question box is disabled while Quinn answers, and a disabled element loses focus.  Once
    // the answer is in, put the cursor back so the next question can be typed straight away -
    // unless the user has moved on to something else in the meantime.
    let wasBusy = false;
    afterRenderEffect(() => {
      const busy = this.quinn.busy();
      if (wasBusy && !busy && this.quinn.isOpen()) {
        const focused = document.activeElement;
        if (
          !focused ||
          focused === document.body ||
          this.messageList().nativeElement.contains(focused)
        ) {
          this.questionBox().nativeElement.focus();
        }
      }
      wasBusy = busy;
    });

    // Opening the pane puts the cursor in the question box, so a question can be typed straight
    // away.  After rendering, because the pane is inert while closed and inert elements cannot take
    // focus.  `preventScroll`, because the pane is still sliding in from beyond the right edge.  If
    // Quinn is still busy with an earlier question the box is disabled; the effect above focuses it
    // once the answer is in.
    let wasOpen = false;
    afterRenderEffect(() => {
      const open = this.quinn.isOpen();
      if (open && !wasOpen) {
        this.questionBox().nativeElement.focus({ preventScroll: true });
      }
      wasOpen = open;
    });
  }

  protected canSend(): boolean {
    return (
      !this.quinn.busy() &&
      !this.quinn.quotaBlock() &&
      !!this.questionForm.question().value().trim()
    );
  }

  /** Opens the usage page; the pane closes itself on the navigation. */
  protected showUsage(): void {
    void this.router.navigate(['/usage']);
  }

  /** A click on a link in a message: navigate within the app, or open other sites in a new tab. */
  protected followLink(event: MouseEvent): void {
    const link = (event.target as Element).closest('a');
    if (!link?.href || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    event.preventDefault();
    const url = new URL(link.href);
    if (url.origin === location.origin) {
      this.quinn.close();
      void this.router.navigateByUrl(url.pathname + url.search + url.hash);
    } else {
      window.open(url.href, '_blank', 'noopener');
    }
  }

  /** Enter sends; Shift+Enter starts a new line. */
  protected sendOnEnter(event: Event): void {
    if ((event as KeyboardEvent).shiftKey) {
      return;
    }
    event.preventDefault();
    if (this.canSend()) {
      (event.target as HTMLTextAreaElement).form?.requestSubmit();
    }
  }
}
