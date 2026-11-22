import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { MessageModule } from '@openng/optimus-ui/message';
import { ProgressBarModule } from '@openng/optimus-ui/progressbar';
import { ProgressSpinnerModule } from '@openng/optimus-ui/progressspinner';

import { environment } from '../../environments/environment';
import { AppErrorHandler } from '../core/services/error-handler.service';
import { UsageDto, UsageMeterDto, UsagePeriodDto } from './usage.model';

/** A meter, ready to show: the dollars and tokens, the share used, and how worried to look. */
export interface Meter {
  /** Dollars spent. */
  used: number;
  /** The dollar limit; none when null. */
  limit: number | null;
  tokens: number;
  /** 0-100, for the progress bar; 0 when there is no limit. */
  percent: number;
  level: 'ok' | 'warn' | 'over';
}

const PERIOD_TITLES: Record<UsagePeriodDto['period'], string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
};

/** The share at which a meter turns amber. */
const WARN_AT = 80;

/** Turns a meter from the server into what the page shows. */
export function toMeter(meter: UsageMeterDto): Meter {
  if (meter.limit === null || meter.limit <= 0) {
    return { used: meter.used, limit: meter.limit, tokens: meter.tokens, percent: 0, level: 'ok' };
  }

  const percent = Math.min(100, (meter.used / meter.limit) * 100);
  return {
    used: meter.used,
    limit: meter.limit,
    tokens: meter.tokens,
    percent,
    level: meter.used >= meter.limit ? 'over' : percent >= WARN_AT ? 'warn' : 'ok',
  };
}

/**
 * The usage page, from the user menu: what Quinn's answers cost the user and their company today,
 * this week and this month, in dollars against the quotas, with the tokens they took - model by
 * model, since each model has prices and quotas of its own (a local Ollama model typically costs
 * nothing and has no limits).  When a quota of the model Quinn uses is used up, Quinn refuses new
 * questions until it starts over.
 *
 * The numbers are the server's (`UsageController`); this page only shows them.  It reads them when
 * it opens and on Refresh, so a question asked in Quinn's pane meanwhile shows up after a refresh.
 */
@Component({
  selector: 'app-usage',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ButtonDirective,
    MessageModule,
    ProgressBarModule,
    ProgressSpinnerModule,
  ],
  template: `
    <div class="usage">
      <header class="usage__header">
        <div>
          <h1 class="usage__title">Quinn usage</h1>
          <p class="usage__intro">
            What Quinn's answers cost, at each model's prices: the text sent to the model and the
            text it wrote, counted in tokens. When a budget is used up, Quinn takes no new questions
            until it starts over.
          </p>
        </div>
        <button
          pButton
          type="button"
          [outlined]="true"
          [disabled]="usage.isLoading()"
          (click)="usage.reload()"
        >
          <i class="pi pi-refresh"></i>
          Refresh
        </button>
      </header>

      @if (usage.error(); as error) {
        <p-message severity="error">{{ describe(error) }}</p-message>
      } @else if (models(); as models) {
        @for (model of models; track model.key) {
          <section class="usage__model" [attr.aria-label]="model.name">
            <div class="usage__model-header">
              <h2 class="usage__model-name">
                {{ model.provider }} <span class="usage__model-id">{{ model.model }}</span>
              </h2>
              @if (model.isCurrent) {
                <span class="usage__tag usage__tag--current">Quinn uses this now</span>
              }
              @if (model.isUnlimited) {
                <span class="usage__tag">No limits</span>
              }
            </div>

            <div class="usage__periods">
              @for (period of model.periods; track period.period) {
                <section class="usage__period temphire-card" [attr.aria-label]="period.title">
                  <h2 class="usage__period-title">{{ period.title }}</h2>

                  @for (
                    meter of [
                      { who: 'You', value: period.user },
                      { who: company(), value: period.company },
                    ];
                    track meter.who
                  ) {
                    <div
                      class="usage__meter"
                      [class]="'usage__meter usage__meter--' + meter.value.level"
                    >
                      <div class="usage__meter-label">
                        <span class="usage__who">{{ meter.who }}</span>
                        <span class="usage__numbers">
                          @if (meter.value.limit !== null) {
                            {{ meter.value.used | currency: 'USD' : 'symbol' : '1.2-3' }} of
                            {{ meter.value.limit | currency: 'USD' }}
                          } @else if (model.isUnlimited) {
                            no limit
                          } @else {
                            {{ meter.value.used | currency: 'USD' : 'symbol' : '1.2-3' }}, no limit
                          }
                        </span>
                      </div>
                      <span class="usage__tokens">{{ meter.value.tokens | number }} tokens</span>
                      @if (meter.value.limit !== null) {
                        <p-progressbar
                          [value]="meter.value.percent"
                          [showValue]="false"
                          [attr.aria-label]="
                            meter.who + ': ' + (meter.value.percent | number: '1.0-0') + '% used'
                          "
                        />
                      }
                    </div>
                  }

                  @if (!model.isUnlimited) {
                    <p class="usage__resets">
                      Starts over {{ period.resetsAt | date: 'EEEE, MMMM d, h:mm a' }}
                      <span class="usage__utc">(midnight UTC)</span>
                    </p>
                  }
                </section>
              }
            </div>
          </section>
        }
      } @else {
        <div class="usage__loading">
          <p-progressSpinner ariaLabel="Loading usage" />
        </div>
      }
    </div>
  `,
  styles: [
    `
      .usage {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        max-width: 72rem;
        margin: 0 auto;
        padding: 1.5rem;
      }

      .usage__header {
        display: flex;
        align-items: flex-start;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 1rem;
      }

      .usage__title {
        margin: 0 0 0.35rem;
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--temphire-accent);
      }

      .usage__intro {
        margin: 0;
        max-width: 46rem;
        color: #4b5563;
        line-height: 1.45;
      }

      .usage__model {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .usage__model-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.6rem;
      }

      .usage__model-name {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 700;
        color: var(--temphire-accent-deep);
      }

      .usage__model-id {
        font-family: var(--p-font-family-mono, ui-monospace, monospace);
        font-size: 0.95rem;
        font-weight: 500;
        color: #4b5563;
      }

      .usage__tag {
        padding: 0.15rem 0.6rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #374151;
        background: #e5e7eb;
      }

      .usage__tag--current {
        color: #ffffff;
        background: var(--temphire-accent);
      }

      .usage__periods {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
        gap: 1.25rem;
      }

      .usage__period {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1.25rem;
      }

      .usage__period-title {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--temphire-accent);
      }

      .usage__meter {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .usage__meter-label {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        font-size: 0.9rem;
      }

      .usage__who {
        font-weight: 600;
      }

      .usage__numbers {
        color: #4b5563;
        font-variant-numeric: tabular-nums;
      }
      .usage__tokens {
        font-size: 0.8rem;
        color: #6b7280;
        font-variant-numeric: tabular-nums;
      }

      /* The bar turns amber from 80% and red when the quota is used up. */
      .usage__meter--warn {
        --p-progressbar-value-background: #d97706;
      }

      .usage__meter--over {
        --p-progressbar-value-background: #dc2626;
      }

      .usage__meter--over .usage__numbers {
        color: #b91c1c;
        font-weight: 600;
      }

      .usage__resets {
        margin: 0;
        font-size: 0.85rem;
        color: #6b7280;
      }

      .usage__utc {
        white-space: nowrap;
      }

      .usage__loading {
        display: flex;
        justify-content: center;
        padding: 3rem;
      }
    `,
  ],
})
export class UsageComponent {
  /** Read when the page opens; `reload()` reads again. */
  protected readonly usage = httpResource<UsageDto>(() => environment.usageApiRoot);

  protected readonly company = computed(() => this.usage.value()?.companyName ?? 'Your company');

  protected readonly models = computed(() =>
    this.usage.value()?.models.map((model) => ({
      key: `${model.provider}/${model.model}`,
      name: `${model.provider} ${model.model}`,
      provider: model.provider,
      model: model.model,
      isCurrent: model.isCurrent,
      isUnlimited: model.isUnlimited,
      periods: model.periods.map((period) => ({
        period: period.period,
        title: PERIOD_TITLES[period.period],
        resetsAt: period.resetsAt,
        user: toMeter(period.user),
        company: toMeter(period.company),
      })),
    })),
  );

  protected describe(error: unknown): string {
    return AppErrorHandler.describe(error).detail;
  }
}
