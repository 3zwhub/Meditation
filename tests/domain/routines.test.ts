import { describe, expect, it } from 'vitest';
import { EVENING_CLOSINGS, buildRoutine, eveningClosing, nextLadderStep, suggestTodayTasks } from '../../src/domain/routines';
import type { ApproachTask } from '../../src/domain/types';

const modules = (steps: ReturnType<typeof buildRoutine>) => steps.flatMap((s) => (s.kind === 'module' ? [`${s.module}/${s.variant}`] : [s.kind]));

describe('루틴 구성 (설계 7.2)', () => {
  it('아침: 체크인 → BR02 최소 → 확언 → 다가갈 일', () => {
    expect(modules(buildRoutine('morning', { affirmationsEnabled: true, worryNotesToday: 0 }))).toEqual(['checkin', 'BR02/minimal', 'AF01/minimal', 'todayTask', 'end']);
  });
  it('확언을 끄면 아침 루틴에서 빠진다', () => {
    expect(modules(buildRoutine('morning', { affirmationsEnabled: false, worryNotesToday: 0 }))).not.toContain('AF01/minimal');
  });
  it('저녁: 걱정 메모가 있을 때만 걱정 시간', () => {
    expect(modules(buildRoutine('evening', { affirmationsEnabled: true, worryNotesToday: 2 }))).toEqual(['CB03/basic', 'JR01/basic', 'end']);
    expect(modules(buildRoutine('evening', { affirmationsEnabled: true, worryNotesToday: 0 }))).toEqual(['JR01/basic', 'end']);
  });
  it('컨디션이 나쁜 날은 1분 안팎', () => {
    expect(modules(buildRoutine('morningMin', { affirmationsEnabled: true, worryNotesToday: 3 }))).toEqual(['checkin', 'BR01/minimal', 'end']);
    expect(modules(buildRoutine('eveningMin', { affirmationsEnabled: true, worryNotesToday: 3 }))).toEqual(['JR01/minimal', 'end']);
  });
});

const task = (over: Partial<ApproachTask>): ApproachTask => ({
  id: 't1',
  createdAt: '',
  title: '회의에서 의견 말하기',
  ladder: [
    { step: 1, action: '한 문장 적기' },
    { step: 2, action: '동의한다고 말하기' },
    { step: 3, action: '개선안 말하기' },
  ],
  archived: false,
  ...over,
});

describe('오늘 다가갈 작은 일', () => {
  it('사다리의 다음 단계, 끝까지 갔으면 마지막 단계', () => {
    expect(nextLadderStep(task({}))?.step).toBe(1);
    expect(nextLadderStep(task({ currentStep: 1 }))?.step).toBe(2);
    expect(nextLadderStep(task({ currentStep: 3 }))?.step).toBe(3);
    expect(nextLadderStep(task({ ladder: [] }))).toBeUndefined();
  });
  it('어제 적은 일 → 사다리 → 걱정 시간의 할 일 순서, 중복은 한 번만', () => {
    const s = suggestTodayTasks({
      tomorrowTask: '동의한다고 말하기',
      approachTasks: [task({ currentStep: 1 }), task({ id: 't2', archived: true })],
      worryActions: ['기준표 읽기', ' '],
    });
    expect(s.map((x) => [x.source, x.text])).toEqual([
      ['tomorrowTask', '동의한다고 말하기'],
      ['worry', '기준표 읽기'],
    ]);
  });
});

describe('저녁 마무리 문장', () => {
  it('날마다 돌아가며', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03'].map(eveningClosing);
    expect(new Set(days).size).toBe(3);
    for (const d of days) expect(EVENING_CLOSINGS).toContain(d);
  });
});
