// 확언 고르기 (2단계 AF01). 상태에 맞는 형태에서, 필요한 값({가치} 등)이 없는 문장은 빼고 고른다.
import type { StateId, TimeOfDay } from './types';

export type AffirmationForm = 'acceptance' | 'process' | 'value' | 'compassion';

export interface AffirmationLike {
  id: string;
  form: AffirmationForm;
  needs?: ('value' | 'task')[];
}

// AF01 "상태 → 형태 매칭"
const FORMS_BY_STATE: Record<StateId, AffirmationForm[]> = {
  A: ['acceptance'],
  B: ['acceptance', 'process'],
  C: ['value'],
  D: ['acceptance'],
  E: ['process', 'compassion'],
  F: ['process', 'value'],
};

export function formsFor(state: StateId | undefined, time: TimeOfDay): AffirmationForm[] {
  if (state) return FORMS_BY_STATE[state];
  if (time === 'evening' || time === 'night') return ['compassion'];
  return ['process'];
}

/** 같은 날에는 같은 문장이 나오도록 날짜로 고른다 (다시 열 때마다 문장이 바뀌지 않게). */
export function pickAffirmation<T extends AffirmationLike>(
  list: T[],
  opts: { state?: StateId; time: TimeOfDay; day: string; have?: ('value' | 'task')[] },
): T | undefined {
  const forms = formsFor(opts.state, opts.time);
  const have = new Set(opts.have ?? []);
  const pool = list.filter((a) => forms.includes(a.form) && (a.needs ?? []).every((n) => have.has(n)));
  if (!pool.length) return undefined;
  const seed = [...opts.day].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return pool[seed % pool.length];
}

/** 믿는 정도가 이보다 낮으면 더 약한 버전을 보여준다. */
export const WEAKER_BELOW = 3;

/** 가치형 확언의 {가치} 자리에 내 가치를 넣는다. */
export function fillAffirmation(text: string, value?: string): string {
  if (!value) return text;
  return text.replace('{가치}을/를', `'${value}'을/를`).replace('{가치}', value);
}
