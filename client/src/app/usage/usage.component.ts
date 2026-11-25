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
  templateUrl: './usage.component.html',
  styleUrl: './usage.component.css',
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
