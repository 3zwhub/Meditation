import { describe, expect, it } from 'vitest';
import { addDays, isoWithOffset, localDate, timeOfDay } from '../../src/domain/day';

describe('하루 경계 (설계 2.1)', () => {
  it('새벽 4시 전은 전날로 본다', () => {
    expect(localDate(new Date(2026, 10, 3, 1, 30))).toBe('2026-11-02');
    expect(localDate(new Date(2026, 10, 3, 3, 59))).toBe('2026-11-02');
    expect(localDate(new Date(2026, 10, 3, 4, 0))).toBe('2026-11-03');
  });
  it('월·연도 경계를 넘는다', () => {
    expect(localDate(new Date(2027, 0, 1, 2, 0))).toBe('2026-12-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('시간대 구분', () => {
    expect(timeOfDay(new Date(2026, 0, 1, 7))).toBe('morning');
    expect(timeOfDay(new Date(2026, 0, 1, 14))).toBe('day');
    expect(timeOfDay(new Date(2026, 0, 1, 21))).toBe('evening');
    expect(timeOfDay(new Date(2026, 0, 1, 2))).toBe('night');
  });
  it('ISO 문자열에 시간대 오프셋이 들어간다', () => {
    expect(isoWithOffset(new Date(2026, 10, 2, 14, 20, 11))).toMatch(/^2026-11-02T14:20:11[+-]\d\d:\d\d$/);
  });
});
