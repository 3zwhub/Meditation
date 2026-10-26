// GAD-7·PHQ-9 점수와 실시 주기 (설계 4.1, 4.2). 점수는 진단이 아니라 참고용이다.
import { addDays } from './day';
import type { Assessment } from './types';

export interface Band {
  min: number;
  max: number;
  label: string;
  message: string;
  recommend: 'none' | 'suggest' | 'strong';
}

export const MAX_ITEM_SCORE = 3;

export function scoreAssessment(answers: number[], bands: Band[]): { total: number; band: Band } {
  if (answers.some((a) => !Number.isInteger(a) || a < 0 || a > MAX_ITEM_SCORE)) throw new Error('응답은 0~3점이어야 해요');
  const total = answers.reduce((s, a) => s + a, 0);
  const band = bands.find((b) => total >= b.min && total <= b.max);
  if (!band) throw new Error(`점수 구간이 없어요: ${total}`);
  return { total, band };
}

export const ASSESSMENT_INTERVAL_DAYS = 14;

/** 마지막 실시 후 14일이 지났거나 한 번도 안 했으면 실시할 때. */
export function assessmentDue(last: Pick<Assessment, 'localDate'> | undefined, today: string): boolean {
  if (!last) return true;
  return addDays(last.localDate, ASSESSMENT_INTERVAL_DAYS) <= today;
}

/**
 * 기분·에너지가 14일 이상 4점 이하이면 PHQ-9를 바로 제안한다 (1단계 5장 조정 규칙).
 * dailyLow: 날짜별로 "그날 기분 또는 에너지의 대표 점수가 4점 이하였는지".
 */
export function persistentLowMood(dailyLow: Map<string, boolean>, today: string, days = 14): boolean {
  for (let i = 0; i < days; i++) {
    if (dailyLow.get(addDays(today, -i)) !== true) return false;
  }
  return true;
}
