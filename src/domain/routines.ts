// 아침·저녁 루틴 (설계 7.2, 1단계 3장). 순서만 정하고, 화면은 src/screens/Routine.tsx가 그린다.
import type { ApproachTask, VariantKey } from './types';

export type RoutineName = 'morning' | 'morningMin' | 'evening' | 'eveningMin';

export type RoutineStep =
  | { kind: 'checkin' }
  | { kind: 'module'; module: string; variant: VariantKey }
  | { kind: 'todayTask' }
  | { kind: 'end' };

export const ROUTINE_TITLE: Record<RoutineName, string> = {
  morning: '아침 루틴',
  morningMin: '아침 루틴 (최소)',
  evening: '저녁 기록',
  eveningMin: '저녁 기록 (최소)',
};

export function buildRoutine(name: RoutineName, ctx: { affirmationsEnabled: boolean; worryNotesToday: number }): RoutineStep[] {
  switch (name) {
    // 아침: 체크인 → BR02 최소 → AF01 최소(확언 켜짐 시) → 오늘 다가갈 작은 일 (설계 7.2)
    case 'morning':
      return [
        { kind: 'checkin' },
        { kind: 'module', module: 'BR02', variant: 'minimal' },
        ...(ctx.affirmationsEnabled ? [{ kind: 'module', module: 'AF01', variant: 'minimal' } as const] : []),
        { kind: 'todayTask' },
        { kind: 'end' },
      ];
    // 컨디션이 나쁜 날: 아침 체크인 + BR01 3회 (2단계 sequences.md)
    case 'morningMin':
      return [{ kind: 'checkin' }, { kind: 'module', module: 'BR01', variant: 'minimal' }, { kind: 'end' }];
    // 저녁: (오늘 걱정 메모가 있으면) 걱정 시간 → JR01 (설계 7.2)
    case 'evening':
      return [
        ...(ctx.worryNotesToday > 0 ? [{ kind: 'module', module: 'CB03', variant: 'basic' } as const] : []),
        { kind: 'module', module: 'JR01', variant: 'basic' },
        { kind: 'end' },
      ];
    case 'eveningMin':
      return [{ kind: 'module', module: 'JR01', variant: 'minimal' }, { kind: 'end' }];
  }
}

export interface TaskSuggestion {
  text: string;
  source: 'tomorrowTask' | 'ladder' | 'worry';
  hint: string;
  approachTaskId?: string;
}

/** 사다리에서 다음에 할 단계: 마지막으로 한 단계의 다음, 끝까지 갔으면 마지막 단계를 다시. */
export function nextLadderStep(task: Pick<ApproachTask, 'ladder' | 'currentStep'>) {
  if (!task.ladder.length) return undefined;
  const sorted = [...task.ladder].sort((a, b) => a.step - b.step);
  return sorted.find((s) => s.step > (task.currentStep ?? 0)) ?? sorted[sorted.length - 1];
}

/** "오늘 다가갈 작은 일" 후보 (설계 7.2 아침 흐름). 같은 문장은 한 번만. */
export function suggestTodayTasks(input: {
  tomorrowTask?: string;
  approachTasks: ApproachTask[];
  worryActions: string[];
}): TaskSuggestion[] {
  const out: TaskSuggestion[] = [];
  if (input.tomorrowTask?.trim()) out.push({ text: input.tomorrowTask.trim(), source: 'tomorrowTask', hint: '어제 저녁에 적어 둔 일' });
  for (const t of input.approachTasks.filter((x) => !x.archived)) {
    const next = nextLadderStep(t);
    if (next) out.push({ text: next.action, source: 'ladder', hint: `"${t.title}" 사다리 ${next.step}단계`, approachTaskId: t.id });
  }
  for (const a of input.worryActions) if (a.trim()) out.push({ text: a.trim(), source: 'worry', hint: '걱정 시간에 정한 할 수 있는 일' });
  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.text) ? false : (seen.add(s.text), true))).slice(0, 5);
}

// JR01 마무리 문장: 날마다 돌아가며 보여준다 (2단계 JR01)
export const EVENING_CLOSINGS = [
  '오늘 하루도 지나왔어요. 수고 많았어요.',
  '불안한 순간이 있었어도, 그게 오늘의 전부는 아니에요.',
  '오늘 피한 일이 있어도 괜찮아요. 내일 다시 작은 걸음부터 하면 돼요.',
];

export function eveningClosing(day: string): string {
  const n = Number(day.replaceAll('-', ''));
  return EVENING_CLOSINGS[n % EVENING_CLOSINGS.length];
}
