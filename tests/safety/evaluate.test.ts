import { describe, expect, it } from 'vitest';
import { emphasizeCrisis, evaluateSafety, lowMoodStreak, needsSafetyCheck, representativeMood } from '../../src/safety/evaluate';

const j = (localDate: string, mood: number) => ({ localDate, mood, createdAt: `${localDate}T22:00:00+09:00` });
const c = (localDate: string, mood: number) => ({ localDate, mood });

describe('PHQ-9 9번 (설계 5.2)', () => {
  it.each([[0, false], [1, true], [2, true], [3, true]])('9번 = %i → 안전 확인 %s', (item9, expected) => {
    expect(needsSafetyCheck({ instrument: 'PHQ9', item9 })).toBe(expected);
  });
  it('GAD-7에는 9번이 없다', () => {
    expect(needsSafetyCheck({ instrument: 'GAD7' })).toBe(false);
  });
});

describe('하루 대표 기분 점수', () => {
  it('저녁 기록이 체크인보다 우선', () => {
    expect(representativeMood('2026-11-02', [j('2026-11-02', 6)], [c('2026-11-02', 1)])).toBe(6);
  });
  it('저녁 기록이 없으면 체크인 중 가장 낮은 점수', () => {
    expect(representativeMood('2026-11-02', [], [c('2026-11-02', 5), c('2026-11-02', 3)])).toBe(3);
  });
  it('기록이 없으면 undefined', () => {
    expect(representativeMood('2026-11-02', [], [])).toBeUndefined();
  });
});

describe('기분 2점 이하 3일 연속 (설계 8.2-3)', () => {
  const now = new Date(2026, 10, 4, 21, 0); // 11월 4일 저녁
  it('2,2,2 → 안내', () => {
    expect(lowMoodStreak(now, [j('2026-11-02', 2), j('2026-11-03', 1), j('2026-11-04', 2)], [])).toBe(true);
  });
  it('2,2,3 → 없음', () => {
    expect(lowMoodStreak(now, [j('2026-11-02', 2), j('2026-11-03', 2), j('2026-11-04', 3)], [])).toBe(false);
  });
  it('기록이 빠진 날이 끼면 연속이 아니다', () => {
    expect(lowMoodStreak(now, [j('2026-11-02', 2), j('2026-11-04', 2)], [])).toBe(false);
  });
  it('오늘 기록이 아직 없으면 어제까지 3일을 본다', () => {
    expect(lowMoodStreak(now, [j('2026-11-01', 2), j('2026-11-02', 2), j('2026-11-03', 2)], [])).toBe(true);
  });
  it('새벽 3시 기록은 전날로 계산한다', () => {
    const lateNight = new Date(2026, 10, 5, 3, 0); // 11월 5일 새벽 3시 = 11월 4일
    expect(lowMoodStreak(lateNight, [j('2026-11-02', 2), j('2026-11-03', 2), j('2026-11-04', 2)], [])).toBe(true);
  });
  it('하루에 한 번만 보여준다', () => {
    const journals = [j('2026-11-02', 2), j('2026-11-03', 2), j('2026-11-04', 2)];
    expect(evaluateSafety({ now, journals, checkins: [] })).toEqual({ kind: 'lowMood3Days' });
    expect(evaluateSafety({ now, journals, checkins: [], lowMoodShownOn: '2026-11-04' })).toBeNull();
  });
});

describe('위기 버튼 강조', () => {
  it.each([[0, true], [2, true], [3, false], [undefined, false]])('기분 %s → %s', (mood, expected) => {
    expect(emphasizeCrisis(mood)).toBe(expected);
  });
});
