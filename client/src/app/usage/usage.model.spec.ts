import {
  UsageDto,
  UsagePeriodDto,
  quotaBlock,
  quotaBlockMessage,
  waitInWords,
} from './usage.model';

describe('quotaBlock', () => {
  const now = new Date('2026-11-18T17:19:00Z');

  const period = (
    name: UsagePeriodDto['period'],
    resetsAt: string,
    user: [number, number | null],
    company: [number, number | null],
  ): UsagePeriodDto => ({
    period: name,
    start: '',
    end: '',
    resetsAt,
    user: { used: user[0], limit: user[1], tokens: 0 },
    company: { used: company[0], limit: company[1], tokens: 0 },
  });

  const usage = (periods: UsagePeriodDto[], isUnlimited = false): UsageDto => ({
    companyName: 'Harbor Staffing',
    models: [
      {
        provider: 'Ollama',
        model: 'qwen3:4b-instruct',
        isCurrent: false,
        isUnlimited: true,
        periods: [],
      },
      { provider: 'Claude', model: 'claude-sonnet-5-5', isCurrent: true, isUnlimited, periods },
    ],
  });

  // Dollars: $0.50 a day, $1.25 a week and $3 a month for the user; $1.50 a day and $10 a month
  // for the company.
  const day = (user: number, company = 0) =>
    period('day', '2026-11-19T00:00:00Z', [user, 0.5], [company, 1.5]);
  const week = (user: number) => period('week', '2026-11-23T00:00:00Z', [user, 1.25], [0, null]);
  const month = (user: number, company = 0) =>
    period('month', '2026-12-01T00:00:00Z', [user, 3], [company, 10]);

  it('is null while every quota of the current model has money left', () => {
    expect(quotaBlock(usage([day(0.49), week(0.49), month(0.49)]), now)).toBeNull();
    expect(quotaBlock(undefined, now)).toBeNull();
  });

  it("names the period that is used up, the user's quota before the company's", () => {
    const block = quotaBlock(usage([day(0.2, 1.5), week(1.25), month(1.25)]), now);

    expect(block).toMatchObject({ period: 'week', isCompany: false, limit: 1.25 });
    expect(block?.resetsAt).toEqual(new Date('2026-11-23T00:00:00Z'));
  });

  it("falls back to the company's quota", () => {
    expect(quotaBlock(usage([day(0.1, 1.5), week(0.1), month(0.1)]), now)).toMatchObject({
      period: 'day',
      isCompany: true,
    });
  });

  it('ignores a period that has started over since the usage was read', () => {
    const later = new Date('2026-11-19T00:00:30Z');

    expect(quotaBlock(usage([day(0.5), week(0.1), month(0.1)]), later)).toBeNull();
  });

  it('never blocks an unlimited model', () => {
    expect(quotaBlock(usage([day(0.5)], true), now)).toBeNull();
  });

  it('says which quota, in dollars, and how long to wait', () => {
    const block = quotaBlock(usage([day(0.5), week(0.1), month(0.1)]), now)!;

    expect(quotaBlockMessage(block, now)).toBe(
      "You've used up your daily Quinn allowance ($0.50). You can ask again in 6 hours and 41 minutes.",
    );
  });
});

describe('waitInWords', () => {
  const minutes = (n: number) => n * 60_000;

  it('words a wait as the server does, rounded up to the minute', () => {
    expect(waitInWords(minutes(0.5))).toBe('1 minute');
    expect(waitInWords(minutes(12))).toBe('12 minutes');
    expect(waitInWords(minutes(60))).toBe('1 hour');
    expect(waitInWords(minutes(401))).toBe('6 hours and 41 minutes');
    expect(waitInWords(minutes(1440))).toBe('1 day');
    expect(waitInWords(minutes(4560))).toBe('3 days and 4 hours');
  });
});
