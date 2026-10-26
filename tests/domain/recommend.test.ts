import { describe, expect, it } from 'vitest';
import { addDays, localDate } from '../../src/domain/day';
import {
  CALMING_OVERUSE_BANNER,
  quickStartPicks,
  recommend,
  type CatalogEntry,
  type RecommendInput,
} from '../../src/domain/recommend';
import { DEFAULT_SETTINGS, type Checkin, type ModuleKind, type RecommendationRecord, type Session } from '../../src/domain/types';

const NOW = new Date(2026, 10, 20, 14, 0);
const TODAY = localDate(NOW);

const entry = (id: string, kind: ModuleKind, mainScale = 'anxiety'): CatalogEntry => ({
  id,
  kind,
  mainScale,
  summary: `${id} 요약`,
  variants: [
    { key: 'minimal', estimatedSec: 45 },
    { key: 'basic', estimatedSec: 180 },
  ],
});

const FULL: CatalogEntry[] = [
  entry('BR01', 'calming'), entry('BR02', 'calming'), entry('GR01', 'calming'), entry('DB01', 'calming'),
  entry('DB02', 'cognitive', 'urge'), entry('CB01', 'cognitive'), entry('CB02', 'cognitive'), entry('CB03', 'cognitive'),
  entry('AC01', 'cognitive'), entry('AC03', 'approach', 'willingness'), entry('DB03', 'approach'),
  entry('MD01', 'reflective'), entry('MD02', 'reflective'), entry('CB05', 'activation'), entry('AF01', 'reflective'),
];

function input(over: Partial<RecommendInput['checkin']> = {}, extra: Partial<RecommendInput> = {}): RecommendInput {
  return {
    checkin: { anxiety: 5, mood: 5, energy: 5, states: ['B'], available: 180, ...over },
    settings: DEFAULT_SETTINGS,
    now: NOW,
    catalog: FULL,
    history: { sessions: [], checkins: [], recommendations: [] },
    ...extra,
  };
}

let n = 0;
function session(moduleId: string, day: string, pre: number, post: number, over: Partial<Session> = {}): Session {
  n++;
  return {
    id: `s${n}`, createdAt: `${day}T10:00:00+09:00`, localDate: day, timeOfDay: 'morning',
    moduleId, contentVersion: 1, variant: 'minimal', startedAt: `${day}T10:00:00+09:00`, status: 'completed',
    pre: { anxiety: pre }, post: { anxiety: post }, answers: {}, entry: 'recommendation', ...over,
  };
}

describe('상태 판별', () => {
  it('7. 불안 8 + 상태 B → A 경로, BR01이 1순위', () => {
    const r = recommend(input({ anxiety: 8, states: ['B'] }));
    expect(r.state).toBe('A');
    expect(r.primary.module).toBe('BR01');
  });
  it('8. C와 B를 함께 고르면 C가 우선', () => {
    expect(recommend(input({ states: ['B', 'C'] })).state).toBe('C');
  });
  it('D는 A보다 우선', () => {
    expect(recommend(input({ states: ['A', 'D'], anxiety: 9 })).primary.module).toBe('DB01');
  });
  it('감정이 시키는 행동이 경로를 정한다', () => {
    expect(recommend(input({ states: ['F'] }, { urgeAction: 'avoid' })).state).toBe('C');
    expect(recommend(input({ states: ['F'] }, { urgeAction: 'check' })).state).toBe('B');
  });
  it('불안 7점 이상이면 감정이 시키는 행동보다 몸 먼저', () => {
    expect(recommend(input({ states: ['C'], anxiety: 8 }, { urgeAction: 'avoid' })).state).toBe('A');
    expect(recommend(input({ states: ['B'], anxiety: 8 }, { urgeAction: 'anger' })).state).toBe('D');
  });
});

describe('개인 설정과 조건', () => {
  it('9. 그라운딩 먼저 → A의 1순위 GR01', () => {
    const r = recommend(input({ anxiety: 8, states: ['A'] }, { settings: { ...DEFAULT_SETTINGS, groundingFirst: true } }));
    expect(r.primary.module).toBe('GR01');
    expect(r.primary.reason).toContain('주변 감각');
  });
  it('10. E + 에너지 2 → MD01 없음, CB05 1순위', () => {
    const r = recommend(input({ states: ['E'], energy: 2 }));
    expect(r.primary.module).toBe('CB05');
    expect([r.primary, ...r.alternatives].map((p) => p.module)).not.toContain('MD01');
  });
  it('11. 같은 생각을 3회 이상 기록 → AC01 1순위, DB03이 뒤따름', () => {
    const r = recommend(input({ states: ['B'], thoughtKind: 'prediction' }, {
      history: { sessions: [], checkins: [], recommendations: [], maxThoughtRecordCount: 3 },
    }));
    expect(r.primary.module).toBe('AC01');
    expect(r.alternatives.map((a) => a.module)).toContain('DB03');
  });
  it('B의 3순위: 확인 가능한 예측이면 CB02, 만약에면 AC01', () => {
    const pred = recommend(input({ states: ['B'], thoughtKind: 'prediction' }));
    expect(pred.alternatives[1].module).toBe('CB02');
    const whatIf = recommend(input({ states: ['B'], thoughtKind: 'whatIf' }));
    expect(whatIf.alternatives[1].module).toBe('AC01');
  });
  it('15. 가용 시간 60초 → 최소 버전만', () => {
    const r = recommend(input({ available: 60 }));
    expect([r.primary, ...r.alternatives].every((p) => p.variant === 'minimal')).toBe(true);
    expect(recommend(input({ available: 300 })).primary.variant).toBe('basic');
  });
});

describe('반복 추천 방지', () => {
  it('12. 같은 모듈을 오늘 2번 거절하면 1순위가 아니다', () => {
    const declined = (i: number): RecommendationRecord => ({
      id: `r${i}`, createdAt: '', localDate: TODAY, timeOfDay: 'day', checkinId: 'c',
      primary: { module: 'DB02', variant: 'minimal', reason: '' }, alternatives: [], chosen: 'declined',
    });
    const r = recommend(input({ states: ['B'] }, {
      history: { sessions: [], checkins: [], recommendations: [declined(1), declined(2)] },
    }));
    expect(r.primary.module).not.toBe('DB02');
  });
  it('30분 안에 한 모듈을 바로 다시 1순위로 내지 않는다', () => {
    const recent = session('BR01', TODAY, 8, 6, { startedAt: new Date(NOW.getTime() - 10 * 60_000).toISOString() });
    const r = recommend(input({ anxiety: 8, states: ['A'] }, {
      history: { sessions: [recent], checkins: [], recommendations: [] },
    }));
    expect(r.primary.module).toBe('GR01');
  });
});

describe('개인화 (14일 이후)', () => {
  const checkinA: Checkin = {
    id: 'cA', createdAt: '', localDate: TODAY, timeOfDay: 'day', anxiety: 8, mood: 5, energy: 5,
    states: ['A'], available: 180, source: 'manual',
  };
  it('13. 14일 미만이면 순서를 바꾸지 않는다', () => {
    const sessions = [0, 1, 2].map((i) => session('GR01', addDays(TODAY, -i), 8, 3, { checkinId: 'cA' }));
    const r = recommend(input({ anxiety: 8, states: ['A'] }, { history: { sessions, checkins: [checkinA], recommendations: [] } }));
    expect(r.primary.module).toBe('BR01');
  });
  it('13. 14일 이상, 효과가 큰 모듈은 1순위로 오른다', () => {
    const old = session('BR01', addDays(TODAY, -20), 5, 5);
    const sessions = [old, ...[1, 2, 3].map((i) => session('GR01', addDays(TODAY, -i), 8, 3, { checkinId: 'cA' }))];
    const r = recommend(input({ anxiety: 8, states: ['A'] }, { history: { sessions, checkins: [checkinA], recommendations: [] } }));
    expect(r.primary.module).toBe('GR01');
    expect(r.primary.reason).toContain('평균 5.0점');
  });
  it('13. A·D에서는 진정 기법만 1순위가 될 수 있다', () => {
    const checkinD: Checkin = { ...checkinA, id: 'cD', states: ['D'], anxiety: 9 };
    const old = session('BR01', addDays(TODAY, -20), 5, 5);
    const sessions = [old, ...[1, 2, 3].map((i) =>
      session('DB02', addDays(TODAY, -i), 8, 2, { checkinId: 'cD', pre: { urge: 9 }, post: { urge: 2 } }))];
    const r = recommend(input({ anxiety: 9, states: ['D'] }, { history: { sessions, checkins: [checkinD], recommendations: [] } }));
    expect(r.primary.module).toBe('DB01');
  });
});

describe('진정 기법 과다 사용', () => {
  it('14. 14일간 진정 모듈 80% 이상이면 배너', () => {
    const sessions = [0, 1, 2, 3, 4].map((i) => session(i % 2 ? 'BR01' : 'GR01', addDays(TODAY, -i), 6, 4));
    const r = recommend(input({}, { history: { sessions, checkins: [], recommendations: [] } }));
    expect(r.banner).toBe(CALMING_OVERUSE_BANNER);
  });
  it('다가가기 모듈이 아직 없으면 배너를 띄우지 않는다', () => {
    const sessions = [0, 1, 2, 3, 4].map((i) => session('BR01', addDays(TODAY, -i), 6, 4));
    const catalog = FULL.filter((c) => c.id !== 'AC03');
    expect(recommend(input({}, { catalog, history: { sessions, checkins: [], recommendations: [] } })).banner).toBeUndefined();
  });
});

describe('MVP 콘텐츠가 일부만 있을 때', () => {
  const PARTIAL = FULL.filter((c) => ['BR01', 'GR01', 'DB02'].includes(c.id));
  it('없는 모듈은 추천하지 않고 3개를 채운다', () => {
    for (const s of ['A', 'B', 'C', 'D', 'E', 'F'] as const) {
      const r = recommend(input({ states: [s] }, { catalog: PARTIAL }));
      const ids = [r.primary, ...r.alternatives].map((p) => p.module);
      expect(ids).toHaveLength(3);
      expect(ids.every((id) => PARTIAL.some((c) => c.id === id))).toBe(true);
    }
  });
});

describe('바로 시작 카드', () => {
  it('기본은 BR01, GR01, DB02이고 그라운딩 먼저면 GR01이 앞', () => {
    expect(quickStartPicks({ settings: DEFAULT_SETTINGS, sessions: [], now: NOW, catalog: FULL })).toEqual(['BR01', 'GR01', 'DB02']);
    expect(quickStartPicks({ settings: { ...DEFAULT_SETTINGS, groundingFirst: true }, sessions: [], now: NOW, catalog: FULL })[0]).toBe('GR01');
  });
  it('14일 이후에는 효과가 좋았던 최소 버전이 앞으로', () => {
    const sessions = [session('BR01', addDays(TODAY, -20), 5, 5), ...[1, 2, 3].map((i) => session('CB01', addDays(TODAY, -i), 7, 2))];
    expect(quickStartPicks({ settings: DEFAULT_SETTINGS, sessions, now: NOW, catalog: FULL })[0]).toBe('CB01');
  });
});
