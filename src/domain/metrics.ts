// 주간 화면 지표 (설계 4.3)와 조정 규칙 (설계 4.4). 모두 now(오늘)와 기록을 받는 순수 함수다.
import { addDays } from './day';
import {
  APPROACHED,
  type ApproachAttempt,
  type Assessment,
  type Checkin,
  type JournalEntry,
  type ModuleId,
  type ModuleKind,
  type Session,
  type WorryNote,
} from './types';

/** 그 날짜가 속한 주의 월요일. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dow = new Date(y, m - 1, d, 12).getDay(); // 0=일
  return addDays(day, -((dow + 6) % 7));
}

export const weekDays = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined);

type J = Pick<JournalEntry, 'localDate' | 'createdAt' | 'anxiety' | 'mood' | 'response'>;
type C = Pick<Checkin, 'localDate' | 'anxiety' | 'mood'>;

function latestJournal(day: string, journals: J[]) {
  return journals.filter((j) => j.localDate === day).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** 하루 불안: 저녁 기록, 없으면 그날 체크인 평균. */
export function dailyAnxiety(day: string, journals: J[], checkins: C[]): number | undefined {
  const j = latestJournal(day, journals);
  if (j) return j.anxiety;
  return mean(checkins.filter((c) => c.localDate === day).map((c) => c.anxiety));
}

/** 하루 대표 기분: 저녁 기록, 없으면 그날 체크인 중 최저 (1단계 5장). */
export function dailyMood(day: string, journals: J[], checkins: C[]): number | undefined {
  const j = latestJournal(day, journals);
  if (j) return j.mood;
  const ms = checkins.filter((c) => c.localDate === day).map((c) => c.mood);
  return ms.length ? Math.min(...ms) : undefined;
}

export interface ModuleEffect {
  moduleId: ModuleId;
  count: number;
  mean: number;
  enough: boolean; // 3회 이상 (설계 4.3)
}

export interface WeeklyMetrics {
  days: string[];
  practiceDays: number;
  anxiety: (number | undefined)[];
  anxietyAvg?: number;
  prevAnxietyAvg?: number;
  mood: (number | undefined)[];
  moodAvg?: number;
  approached: { count: number; actions: string[] };
  avoidedDays: number;
  effects: ModuleEffect[];
  predictions: { total: number; none: number; partly: number; fully: number; worse: number };
  activation: { count: number; pleasureGap?: number; masteryGap?: number };
  worryTime: { reviewed: number; shrunk: number };
  frequent: { noteLabel?: string; story?: string; bodyPart?: string };
  hasData: boolean;
}

function topOf(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []);
const asNum = (v: unknown) => (typeof v === 'number' ? v : undefined);

export function computeWeekly(input: {
  weekStart: string;
  sessions: Session[];
  checkins: C[];
  journals: J[];
  attempts: ApproachAttempt[];
  worryNotes: WorryNote[];
  mainScale: Map<ModuleId, string>;
  labels?: { noteLabels?: Map<string, string> };
}): WeeklyMetrics {
  const days = weekDays(input.weekStart);
  const inWeek = (d: string) => d >= days[0] && d <= days[6];
  const prevDays = weekDays(addDays(input.weekStart, -7));

  const completed = input.sessions.filter((s) => s.status === 'completed' && inWeek(s.localDate));
  const anxiety = days.map((d) => dailyAnxiety(d, input.journals, input.checkins));
  const mood = days.map((d) => dailyMood(d, input.journals, input.checkins));
  const prev = prevDays.map((d) => dailyAnxiety(d, input.journals, input.checkins)).filter((x): x is number => x !== undefined);

  const approachedList = input.attempts
    .filter((a) => APPROACHED.includes(a.status) && inWeek(a.localDate))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // 연습별 효과: 시작 전·후 점수가 모두 있는 완료 세션만
  const byModule = new Map<ModuleId, number[]>();
  for (const s of completed) {
    const scale = input.mainScale.get(s.moduleId);
    if (!scale || s.pre[scale] === undefined || s.post[scale] === undefined) continue;
    byModule.set(s.moduleId, [...(byModule.get(s.moduleId) ?? []), s.pre[scale] - s.post[scale]]);
  }
  const effects = [...byModule]
    .map(([moduleId, deltas]) => ({ moduleId, count: deltas.length, mean: mean(deltas)!, enough: deltas.length >= 3 }))
    .sort((a, b) => Number(b.enough) - Number(a.enough) || b.mean - a.mean);

  const weekAttempts = input.attempts.filter((a) => inWeek(a.localDate) && a.predictionCameTrue);
  const predictions = { total: weekAttempts.length, none: 0, partly: 0, fully: 0, worse: 0 };
  for (const a of weekAttempts) predictions[a.predictionCameTrue!]++;

  const cb05 = completed.filter((s) => s.moduleId === 'CB05');
  const gap = (exp: string, act: string) =>
    mean(cb05.flatMap((s) => (asNum(s.answers[exp]) !== undefined && asNum(s.answers[act]) !== undefined ? [asNum(s.answers[act])! - asNum(s.answers[exp])!] : [])));

  const reviewed = input.worryNotes.filter((n) => inWeek(n.localDate) && n.stillImportant !== undefined);

  const noteLabels = completed.filter((s) => s.moduleId === 'MD02').flatMap((s) => asStrings(s.answers.r1));
  const stories = completed
    .filter((s) => s.moduleId === 'AC01')
    .flatMap((s) => (s.answers.storyTitle === 'other' ? asStrings(s.answers.storyOther) : asStrings(s.answers.storyTitle)));
  const bodyParts = completed
    .flatMap((s) => [...asStrings(s.answers.bodyParts), ...(s.moduleId === 'MD01' ? asStrings(s.answers.r1) : [])])
    .filter((b) => b !== '잘 모르겠음');

  const noteLabel = topOf(noteLabels);
  return {
    days,
    practiceDays: new Set(completed.map((s) => s.localDate)).size,
    anxiety,
    anxietyAvg: mean(anxiety.filter((x): x is number => x !== undefined)),
    prevAnxietyAvg: mean(prev),
    mood,
    moodAvg: mean(mood.filter((x): x is number => x !== undefined)),
    approached: { count: approachedList.length, actions: approachedList.map((a) => a.action) },
    avoidedDays: days.filter((d) => latestJournal(d, input.journals)?.response?.includes('avoided')).length,
    effects,
    predictions,
    activation: { count: cb05.length, pleasureGap: gap('expectedPleasure', 'actualPleasure'), masteryGap: gap('expectedMastery', 'actualMastery') },
    worryTime: { reviewed: reviewed.length, shrunk: reviewed.filter((n) => n.stillImportant === false).length },
    frequent: {
      noteLabel: noteLabel && (input.labels?.noteLabels?.get(noteLabel) ?? noteLabel),
      story: topOf(stories),
      bodyPart: topOf(bodyParts),
    },
    hasData:
      completed.length > 0 ||
      anxiety.some((x) => x !== undefined) ||
      approachedList.length > 0 ||
      input.worryNotes.some((n) => inWeek(n.localDate)),
  };
}

// ---- 조정 규칙 (설계 4.4) ----

export type Adjustment =
  | { kind: 'approachLow'; count: number }
  | { kind: 'calmingOveruse'; share: number }
  | { kind: 'gadNoDecrease'; totals: number[] };

export function adjustments(input: {
  today: string;
  sessions: Session[];
  attempts: ApproachAttempt[];
  gad7: Pick<Assessment, 'createdAt' | 'total'>[];
  kinds: Map<ModuleId, ModuleKind>;
  /** 전체 기록에서 처음 연습한 날. sessions는 최근 것만 넘어올 수 있으므로 따로 받는다. */
  firstUseDay?: string;
}): Adjustment[] {
  const out: Adjustment[] = [];
  const since = addDays(input.today, -13);
  const firstUse = input.firstUseDay ?? input.sessions.map((s) => s.localDate).sort()[0];

  // 2주간 다가간 일 0~1개 → 사다리 첫 단계를 더 작게 (앱을 2주 이상 쓴 뒤에만)
  if (firstUse && firstUse <= since) {
    const count = input.attempts.filter((a) => APPROACHED.includes(a.status) && a.localDate >= since).length;
    if (count <= 1) out.push({ kind: 'approachLow', count });
  }

  // 14일간 진정 모듈 80% 이상 (5회 이상일 때만)
  const recent = input.sessions.filter((s) => s.status === 'completed' && s.localDate >= since);
  if (recent.length >= 5) {
    const share = recent.filter((s) => input.kinds.get(s.moduleId) === 'calming').length / recent.length;
    if (share >= 0.8) out.push({ kind: 'calmingOveruse', share });
  }

  // GAD-7이 2회 연속 줄지 않음 (최근 3번의 점수가 줄어든 적 없음) → 5단계 점검, 전문가 안내
  const totals = [...input.gad7].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-3).map((a) => a.total);
  if (totals.length === 3 && totals[1] >= totals[0] && totals[2] >= totals[1]) out.push({ kind: 'gadNoDecrease', totals });

  return out;
}
