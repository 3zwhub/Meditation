// 안전 판정 (설계 5장). 순수 함수만 두고, 화면은 이 결과를 그대로 따른다.
// 자동 텍스트 분석은 하지 않는다. 판단 근거는 사용자가 직접 고른 값뿐이다.
import { addDays, localDate } from '../domain/day';
import type { Assessment, Checkin, JournalEntry } from '../domain/types';

export const LOW_MOOD_MAX = 2;
export const LOW_MOOD_DAYS = 3;

/** PHQ-9 9번(죽음이나 자해에 대한 생각)에 1점 이상이면 결과보다 먼저 안전 확인을 한다. */
export function needsSafetyCheck(a: Pick<Assessment, 'instrument' | 'item9'>): boolean {
  return a.instrument === 'PHQ9' && (a.item9 ?? 0) >= 1;
}

/** 기분 0~2점을 입력한 화면에서는 위기 버튼을 강조한다. */
export function emphasizeCrisis(mood: number | undefined): boolean {
  return mood !== undefined && mood <= LOW_MOOD_MAX;
}

/** 하루 대표 기분 점수 = 저녁 기록 점수, 없으면 그날 체크인 중 가장 낮은 기분 점수 (1단계 5장). */
export function representativeMood(
  day: string,
  journals: Pick<JournalEntry, 'localDate' | 'mood' | 'createdAt'>[],
  checkins: Pick<Checkin, 'localDate' | 'mood'>[],
): number | undefined {
  const j = journals.filter((x) => x.localDate === day).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (j) return j.mood;
  const moods = checkins.filter((c) => c.localDate === day).map((c) => c.mood);
  return moods.length ? Math.min(...moods) : undefined;
}

/**
 * 하루 대표 기분 2점 이하가 3일 연속인지.
 * 오늘 점수가 있으면 오늘까지, 아직 없으면 어제까지의 3일을 본다. 기록이 없는 날이 끼면 연속이 아니다.
 */
export function lowMoodStreak(
  now: Date,
  journals: Pick<JournalEntry, 'localDate' | 'mood' | 'createdAt'>[],
  checkins: Pick<Checkin, 'localDate' | 'mood'>[],
  boundaryHour = 4,
): boolean {
  const today = localDate(now, boundaryHour);
  const end = representativeMood(today, journals, checkins) === undefined ? addDays(today, -1) : today;
  for (let i = 0; i < LOW_MOOD_DAYS; i++) {
    const m = representativeMood(addDays(end, -i), journals, checkins);
    if (m === undefined || m > LOW_MOOD_MAX) return false;
  }
  return true;
}

export type SafetyNotice = { kind: 'lowMood3Days' };

/** 앱을 열 때와 기록을 저장할 때마다 호출한다. */
export function evaluateSafety(input: {
  now: Date;
  journals: Pick<JournalEntry, 'localDate' | 'mood' | 'createdAt'>[];
  checkins: Pick<Checkin, 'localDate' | 'mood'>[];
  boundaryHour?: number;
  lowMoodShownOn?: string; // 하루 한 번만 보여준다
}): SafetyNotice | null {
  const today = localDate(input.now, input.boundaryHour ?? 4);
  if (input.lowMoodShownOn === today) return null;
  if (lowMoodStreak(input.now, input.journals, input.checkins, input.boundaryHour ?? 4)) return { kind: 'lowMood3Days' };
  return null;
}
