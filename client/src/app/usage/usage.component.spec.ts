import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { UsageComponent, toMeter } from './usage.component';
import { UsageDto, UsagePeriodDto } from './usage.model';

describe('toMeter', () => {
  it('turns amber from 80% and red when the quota is used up', () => {
    expect(toMeter({ used: 5, limit: 10, tokens: 2000 })).toEqual({
      used: 5,
      limit: 10,
      tokens: 2000,
      percent: 50,
      level: 'ok',
    });
    expect(toMeter({ used: 8, limit: 10, tokens: 0 }).level).toBe('warn');
    expect(toMeter({ used: 10, limit: 10, tokens: 0 }).level).toBe('over');
  });

  it('never fills the bar past 100%', () => {
    expect(toMeter({ used: 15, limit: 10, tokens: 0 }).percent).toBe(100);
  });

  it('has no bar without a limit', () => {
    expect(toMeter({ used: 0, limit: null, tokens: 123456 })).toEqual({
      used: 0,
      limit: null,
      tokens: 123456,
      percent: 0,
      level: 'ok',
    });
  });
});

describe('UsageComponent', () => {
  const period = (
    name: UsagePeriodDto['period'],
    used: number,
    limit: number | null,
    tokens: number,
  ): UsagePeriodDto => ({
    period: name,
    start: '2026-11-18',
    end: '2026-11-19',
    resetsAt: '2026-11-19T00:00:00+00:00',
    user: { used, limit, tokens },
    company: { used: used * 2, limit: limit === null ? null : limit * 3, tokens: tokens * 2 },
  });

  const usage: UsageDto = {
    companyName: 'Harbor Staffing',
    models: [
      {
        provider: 'Claude',
        model: 'claude-sonnet-5-5',
        isCurrent: true,
        isUnlimited: false,
        periods: [
          period('day', 0.425, 0.5, 33000),
          period('week', 0.425, 1.25, 33000),
          period('month', 0.425, 3, 33000),
        ],
      },
      {
        provider: 'Ollama',
        model: 'qwen3:4b-instruct',
        isCurrent: false,
        isUnlimited: true,
        periods: [
          period('day', 0, null, 7000),
          period('week', 0, null, 7000),
          period('month', 0, null, 7000),
        ],
      },
    ],
  };

  async function render() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(UsageComponent);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(environment.usageApiRoot).flush(usage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows each model, the current one first, in dollars with the tokens', async () => {
    const page = await render();

    const models = [...page.querySelectorAll('.usage__model')];
    expect(models.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Claude claude-sonnet-5-5',
      'Ollama qwen3:4b-instruct',
    ]);
    expect(models[0].textContent).toContain('Quinn uses this now');
    expect(models[0].textContent).toContain('Harbor Staffing');
    expect(models[0].textContent).toContain('$0.425 of $0.50');
    expect(models[0].textContent).toContain('33,000 tokens');
  });

  it('warns when a quota is nearly used up', async () => {
    const page = await render();

    const today = page.querySelector('.usage__model .usage__period');
    expect(today?.querySelector('.usage__meter--warn')?.textContent).toContain('You');
  });

  it('shows an unlimited model with its tokens, without bars or reset times', async () => {
    const page = await render();

    const ollama = page.querySelectorAll('.usage__model')[1];
    expect(ollama.textContent).toContain('No limits');
    expect(ollama.textContent).toContain('7,000 tokens');
    expect(ollama.textContent).not.toContain('$');
    expect(ollama.querySelector('p-progressbar')).toBeNull();
    expect(ollama.querySelector('.usage__resets')).toBeNull();
  });
});
