import { describe, expect, it } from 'vitest';
import { formsFor, pickAffirmation } from '../../src/domain/affirmations';

const list = [
  { id: 'AF-ACC-01', form: 'acceptance' as const },
  { id: 'AF-PRO-01', form: 'process' as const },
  { id: 'AF-VAL-01', form: 'value' as const, needs: ['value' as const] },
  { id: 'AF-VAL-02', form: 'value' as const },
  { id: 'AF-COM-01', form: 'compassion' as const },
];

describe('확언 고르기', () => {
  it('상태에 맞는 형태', () => {
    expect(formsFor('A', 'day')).toEqual(['acceptance']);
    expect(formsFor('C', 'day')).toEqual(['value']);
    expect(formsFor(undefined, 'morning')).toEqual(['process']);
    expect(formsFor(undefined, 'evening')).toEqual(['compassion']);
  });
  it('필요한 값이 없는 문장은 고르지 않는다', () => {
    for (const day of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']) {
      expect(pickAffirmation(list, { state: 'C', time: 'day', day })?.id).toBe('AF-VAL-02');
    }
  });
  it('같은 날에는 같은 문장', () => {
    const a = pickAffirmation(list, { state: 'B', time: 'day', day: '2026-11-02' });
    const b = pickAffirmation(list, { state: 'B', time: 'day', day: '2026-11-02' });
    expect(a).toBe(b);
  });
});
