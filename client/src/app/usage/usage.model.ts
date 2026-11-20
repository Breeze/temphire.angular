/**
 * Quinn's token usage and quotas, as `GET api/usage` reports them (see `UsageController`), and what
 * the client works out from them: whether a quota stops Quinn now, and for how long.
 */

/** `GET api/usage`: Quinn's token usage for the signed-in user and their company, per model. */
export interface UsageDto {
  companyName: string | null;
  /** The model Quinn answers with now, first; then any other model the company used in these periods. */
  models: UsageModelDto[];
}

export interface UsageModelDto {
  /** `Claude` or `Ollama`. */
  provider: string;
  /** As the provider names it: `claude-sonnet-5-5`, `qwen3:4b-instruct`. */
  model: string;
  /** Whether Quinn answers with this model now. */
  isCurrent: boolean;
  /** No quota at all, for the user or the company: a local model, say. */
  isUnlimited: boolean;
  /** Today, this week and this month, in that order. */
  periods: UsagePeriodDto[];
}

export interface UsagePeriodDto {
  period: 'day' | 'week' | 'month';
  /** First day of the period, UTC, `yyyy-MM-dd`. */
  start: string;
  /** The day after its last day, `yyyy-MM-dd`. */
  end: string;
  /** When the quota starts over: midnight UTC at the period's end. */
  resetsAt: string;
  user: UsageMeterDto;
  company: UsageMeterDto;
}

/** What was spent, in US dollars, against the limit, and the tokens it bought. */
export interface UsageMeterDto {
  /** Dollars spent. */
  used: number;
  /** The dollar limit; no limit when null. */
  limit: number | null;
  /** Tokens, input and output, for information: the limit is on the dollars. */
  tokens: number;
}

/** A used-up quota that stops Quinn from answering, and when it starts over. */
export interface QuotaBlock {
  period: UsagePeriodDto['period'];
  /** The company's quota rather than the user's own. */
  isCompany: boolean;
  companyName: string | null;
  /** The used-up limit, in dollars. */
  limit: number;
  resetsAt: Date;
}

const usedUp = (meter: UsageMeterDto) => meter.limit !== null && meter.used >= meter.limit;

/**
 * The quota that stops Quinn now, if any: of the model Quinn answers with, the user's own quotas
 * before the company's, the shortest period first - the same order as the server's check
 * (`UsageModelDto.Exceeded` in `UsageController.cs`), which has the final say.  A period that has
 * started over since the usage was read no longer counts.
 */
export function quotaBlock(usage: UsageDto | undefined, now: Date): QuotaBlock | null {
  const current = usage?.models.find((m) => m.isCurrent);
  if (!current || current.isUnlimited) {
    return null;
  }

  const live = current.periods.filter((p) => new Date(p.resetsAt) > now);
  for (const isCompany of [false, true]) {
    const period = live.find((p) => usedUp(isCompany ? p.company : p.user));
    if (period) {
      return {
        period: period.period,
        isCompany,
        companyName: usage!.companyName,
        limit: (isCompany ? period.company.limit : period.user.limit)!,
        resetsAt: new Date(period.resetsAt),
      };
    }
  }

  return null;
}

/**
 * A wait in words, as the server words it (`QuotaMessages.Wait`): "3 days and 4 hours", "6 hours
 * and 41 minutes", "12 minutes".  Rounded up to the minute, so it never promises a moment too early.
 */
export function waitInWords(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const count = (n: number, unit: string) => (n === 1 ? `1 ${unit}` : `${n} ${unit}s`);

  if (days > 0) {
    return hours > 0 ? `${count(days, 'day')} and ${count(hours, 'hour')}` : count(days, 'day');
  }
  if (hours > 0) {
    return mins > 0 ? `${count(hours, 'hour')} and ${count(mins, 'minute')}` : count(hours, 'hour');
  }
  return count(mins, 'minute');
}

const QUOTA_NAMES: Record<UsagePeriodDto['period'], string> = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
};

/** What Quinn's pane says while a quota stops it. */
export function quotaBlockMessage(block: QuotaBlock, now: Date): string {
  const quota = QUOTA_NAMES[block.period];
  const who = block.isCompany
    ? `${block.companyName ?? 'Your company'} has used up its ${quota} Quinn allowance`
    : `You've used up your ${quota} Quinn allowance`;
  const wait = waitInWords(block.resetsAt.getTime() - now.getTime());
  return `${who} (${dollars(block.limit)}). You can ask again in ${wait}.`;
}

/** US dollars, as the server writes them: "$0.50", "$10.00". */
export function dollars(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
