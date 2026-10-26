// 주간 지표와 조정 규칙 (설계 4.3, 4.4). 가짜 데이터 28일분으로 검증한다.
import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/domain/day';
import { adjustments, computeWeekly, dailyAnxiety, weekStart } from '../../src/domain/metrics';
import type { ApproachAttempt, ModuleKind, Session, WorryNote } from '../../src/domain/types';

const MON = '2026-11-16'; // 월요일
const mainScale = new Map([['BR01', 'anxiety'], ['GR01', 'anxiety'], ['DB02', 'urge'], ['CB05', 'mood'], ['MD02', 'noise']]);
const kinds = new Map<string, ModuleKind>([['BR01', 'calming'], ['GR01', 'calming'], ['DB02', 'cognitive'], ['DB03', 'approach']]);

let n = 0;
const session = (moduleId: string, day: string, over: Partial<Session> = {}): Session => ({
  id: `s${++n}`, createdAt: `${day}T10:00:00+09:00`, localDate: day, timeOfDay: 'morning', moduleId, contentVersion: 1,
  variant: 'minimal', startedAt: `${day}T10:00:00+09:00`, status: 'completed', pre: {}, post: {}, answers: {}, entry: 'quickStart', ...over,
});
const attempt = (day: string, status: ApproachAttempt['status'], over: Partial<ApproachAttempt> = {}): ApproachAttempt => ({
  id: `a${++n}`, createdAt: `${day}T15:00:00+09:00`, localDate: day, timeOfDay: 'day', approachTaskId: 't', action: `행동 ${n}`,
  firstStepOnly: true, factCheck: 'notDanger', status, ...over,
});
const journal = (day: string, anxiety: number, mood: number, response?: string[]) =>
  ({ localDate: day, createdAt: `${day}T22:00:00+09:00`, anxiety, mood, response }) as never;

/** 28일분 가짜 기록: 3주 전부터 이번 주 일요일까지. */
function fakeMonth() {
  const sessions: Session[] = [];
  const journals: ReturnType<typeof journal>[] = [];
  for (let i = -21; i < 7; i++) {
    const d = addDays(MON, i);
    if (i % 2 === 0) sessions.push(session('BR01', d, { pre: { anxiety: 7 }, post: { anxiety: 5 } }));
    if (i >= 0) journals.push(journal(d, i < 3 ? 6 : 4, 5, i === 1 ? ['avoided'] : ['approached']));
    else journals.push(journal(d, 7, 4));
  }
  return { sessions, journals };
}

describe('주의 시작', () => {
  it('월요일부터', () => {
    expect(weekStart('2026-11-16')).toBe('2026-11-16');
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // 일요일
    expect(weekStart('2026-11-19')).toBe('2026-11-16');
  });
});

describe('주간 지표 (설계 4.3)', () => {
  const { sessions, journals } = fakeMonth();
  const worry: WorryNote[] = [
    { id: 'w1', createdAt: '', localDate: MON, timeOfDay: 'day', text: 'a', repeatCount: 1, stillImportant: false },
    { id: 'w2', createdAt: '', localDate: MON, timeOfDay: 'day', text: 'b', repeatCount: 1, stillImportant: true },
    { id: 'w3', createdAt: '', localDate: MON, timeOfDay: 'day', text: 'c', repeatCount: 1 },
  ];
  const attempts = [
    attempt(MON, 'done', { predictionCameTrue: 'none' }),
    attempt(addDays(MON, 2), 'stoppedMidway'),
    attempt(addDays(MON, 3), 'planned'),
    attempt(addDays(MON, -3), 'done'),
  ];
  const extra = [
    session('CB05', addDays(MON, 4), { answers: { expectedPleasure: 2, actualPleasure: 5, expectedMastery: 3, actualMastery: 4 } }),
    session('MD02', addDays(MON, 4), { answers: { r1: 'worry' } }),
    session('MD02', addDays(MON, 5), { answers: { r1: 'worry' } }),
    session('GR01', addDays(MON, 5), { pre: { anxiety: 8 }, post: { anxiety: 4 }, answers: { bodyParts: ['가슴'] } }),
    session('BR01', addDays(MON, 6), { status: 'stopped', pre: { anxiety: 9 } }),
  ];
  const m = computeWeekly({
    weekStart: MON, sessions: [...sessions, ...extra], checkins: [], journals, attempts, worryNotes: worry, mainScale,
    labels: { noteLabels: new Map([['worry', '걱정']]) },
  });

  it('연습한 날 (완료 세션이 있는 날)', () => {
    expect(m.practiceDays).toBe(5); // BR01 월·수·금·일 + GR01·MD02 토 (일요일의 멈춘 세션은 세지 않음)
  });
  it('불안 추이와 지난주 비교', () => {
    expect(m.anxiety).toEqual([6, 6, 6, 4, 4, 4, 4]);
    expect(m.anxietyAvg).toBeCloseTo(34 / 7);
    expect(m.prevAnxietyAvg).toBe(7);
  });
  it('다가간 일: 완료와 중간에 멈춘 시도만, 이번 주만', () => {
    expect(m.approached.count).toBe(2);
  });
  it('피한 날', () => {
    expect(m.avoidedDays).toBe(1);
  });
  it('연습별 효과: 3회 미만은 표시만, 3회 이상이 앞', () => {
    expect(m.effects[0]).toMatchObject({ moduleId: 'BR01', count: 4, mean: 2, enough: true });
    expect(m.effects.find((e) => e.moduleId === 'GR01')).toMatchObject({ count: 1, enough: false });
  });
  it('예상 vs 실제', () => {
    expect(m.predictions).toMatchObject({ total: 1, none: 1 });
    expect(m.activation).toMatchObject({ count: 1, pleasureGap: 3, masteryGap: 1 });
  });
  it('걱정 시간에 작아진 걱정', () => {
    expect(m.worryTime).toEqual({ reviewed: 2, shrunk: 1 });
  });
  it('자주 오는 것', () => {
    expect(m.frequent).toMatchObject({ noteLabel: '걱정', bodyPart: '가슴' });
  });
  it('기록이 없는 날은 0이 아니라 비어 있다', () => {
    const empty = computeWeekly({ weekStart: addDays(MON, 7), sessions: [], checkins: [], journals: [], attempts: [], worryNotes: [], mainScale });
    expect(empty.anxiety).toEqual([undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
    expect(empty.hasData).toBe(false);
  });
  it('저녁 기록이 없으면 체크인 평균', () => {
    expect(dailyAnxiety(MON, [], [{ localDate: MON, anxiety: 4, mood: 5 }, { localDate: MON, anxiety: 6, mood: 5 }])).toBe(5);
  });
});

describe('조정 규칙 (설계 4.4)', () => {
  const today = addDays(MON, 6);
  const { sessions } = fakeMonth();

  it('2주 넘게 썼는데 2주간 다가간 일이 0~1개면 사다리를 더 작게', () => {
    const r = adjustments({ today, sessions, attempts: [attempt(addDays(today, -3), 'done')], gad7: [], kinds });
    expect(r).toContainEqual({ kind: 'approachLow', count: 1 });
  });
  it('최근 14일 기록만 넘어와도, 전체 첫 사용일로 2주 넘게 썼는지 판단한다', () => {
    const recentOnly = [session('BR01', addDays(today, -5))];
    expect(adjustments({ today, sessions: recentOnly, attempts: [], gad7: [], kinds, firstUseDay: addDays(today, -40) })).toContainEqual({ kind: 'approachLow', count: 0 });
    expect(adjustments({ today, sessions: recentOnly, attempts: [], gad7: [], kinds, firstUseDay: addDays(today, -5) }).find((a) => a.kind === 'approachLow')).toBeUndefined();
  });
  it('쓴 지 2주가 안 됐으면 다가간 일 안내를 하지 않는다', () => {
    const r = adjustments({ today, sessions: [session('BR01', addDays(today, -3))], attempts: [], gad7: [], kinds });
    expect(r.find((a) => a.kind === 'approachLow')).toBeUndefined();
  });
  it('진정 연습만 80% 이상', () => {
    const r = adjustments({ today, sessions, attempts: [], gad7: [], kinds });
    expect(r.find((a) => a.kind === 'calmingOveruse')).toBeTruthy();
  });
  it('GAD-7이 2번 연속 줄지 않으면 점검 안내, 한 번이라도 줄었으면 없음', () => {
    const g = (totals: number[]) => totals.map((total, i) => ({ total, createdAt: `2026-1${i}-01` }));
    expect(adjustments({ today, sessions: [], attempts: [], gad7: g([10, 10, 12]), kinds })).toContainEqual({ kind: 'gadNoDecrease', totals: [10, 10, 12] });
    expect(adjustments({ today, sessions: [], attempts: [], gad7: g([12, 9, 11]), kinds })).toEqual([]);
    expect(adjustments({ today, sessions: [], attempts: [], gad7: g([10, 12]), kinds })).toEqual([]);
  });
});
