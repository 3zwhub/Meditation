// 상태 판별과 추천 (설계 3장). 설명 가능한 규칙만 쓰고, 순서만 바꾸며 목록에서 빼지 않는다.
import { addDays, localDate } from './day';
import type { Checkin, ModuleId, ModuleKind, RecPick, RecommendationRecord, Session, Settings, StateId, VariantKey } from './types';

export type UrgeAction = 'avoid' | 'hide' | 'ruminate' | 'check' | 'anger' | 'unknown';

/** 추천에 필요한 모듈 정보. 앱에 실제로 들어 있는 모듈만 넘긴다. */
export interface CatalogEntry {
  id: ModuleId;
  kind: ModuleKind;
  mainScale: string;
  variants: { key: VariantKey; estimatedSec: number }[];
  summary: string;
}

export interface RecommendInput {
  checkin: Pick<Checkin, 'anxiety' | 'mood' | 'energy' | 'states' | 'available' | 'thoughtKind'>;
  urgeAction?: UrgeAction;
  settings: Settings;
  now: Date;
  catalog: CatalogEntry[];
  history: {
    sessions: Session[];
    checkins: Checkin[];
    recommendations: RecommendationRecord[];
    worryNotesToday?: number;
    maxThoughtRecordCount?: number;
  };
}

export interface Recommendation {
  state: StateId;
  primary: RecPick;
  alternatives: RecPick[];
  banner?: string;
}

// 각성이 높고 급한 것부터 (설계 3.2의 1번)
const PRIORITY: StateId[] = ['D', 'A', 'C', 'B', 'E', 'F'];

// 설계 3.3 결정표. B의 3순위는 조건에 따라 bThird()가 정한다.
const CANDIDATES: Record<StateId, ModuleId[]> = {
  A: ['BR01', 'GR01', 'DB01'],
  B: ['DB02', 'CB01'],
  C: ['AC03', 'DB03', 'BR02'],
  D: ['DB01', 'DB02', 'GR01'],
  E: ['MD01', 'CB05', 'AF01'],
  F: ['MD02', 'MD01', 'AF01'],
};

// 앱에 아직 없는 모듈 대신 채우는 순서 (MVP 콘텐츠가 다 들어오기 전까지)
const FALLBACK: ModuleId[] = ['GR01', 'BR01', 'DB02', 'BR02', 'CB01'];

const STATE_REASON: Record<StateId, string> = {
  A: '불안이 높을 때는 몸부터 진정시키는 게 도움이 될 수 있어요.',
  B: '걱정이 맴돌 때는 먼저 잠깐 멈추고, 지금 무슨 일이 일어나는지 보는 걸 해볼 수 있어요.',
  C: '불안이 있어도 한 걸음 다가가 볼 수 있어요. 아주 작은 걸음부터요.',
  D: '감정이 너무 클 때는 생각보다 몸을 먼저 바꾸는 게 빠를 수 있어요.',
  E: '기운이 없을 때는 기분을 기다리기보다 아주 작은 것부터 해볼 수 있어요.',
  F: '비교적 괜찮은 날은 연습하기 가장 좋은 날이에요.',
};

export const CALMING_OVERUSE_BANNER =
  '요즘 진정하는 연습을 주로 하셨어요. 불안이 있어도 한 걸음 다가가는 연습도 함께 해볼까요?';

export function resolveState(
  checkin: Pick<Checkin, 'anxiety' | 'states'>,
  urgeAction?: UrgeAction,
): StateId {
  if (urgeAction === 'anger') return 'D';
  // 불안 7점 이상이면 "몸 먼저"가 감정이 시키는 행동보다 우선한다 (1단계 1.4 원칙 1)
  if (checkin.anxiety < 7) {
    if (urgeAction === 'avoid' || urgeAction === 'hide') return 'C';
    if (urgeAction === 'ruminate' || urgeAction === 'check') return 'B';
  }
  const chosen = checkin.states.length ? checkin.states : (['F'] as StateId[]);
  let state = PRIORITY.find((s) => chosen.includes(s)) ?? 'F';
  // 1단계 1.4 원칙 1: 7점 이상이면 몸 먼저
  if (checkin.anxiety >= 7 && ['B', 'C', 'E', 'F'].includes(state)) state = 'A';
  return state;
}

function bThird(input: RecommendInput): ModuleId[] {
  if ((input.history.worryNotesToday ?? 0) > 0) return ['CB03', 'AC01'];
  if ((input.history.maxThoughtRecordCount ?? 0) >= 3) return ['AC01', 'DB03'];
  if (input.checkin.thoughtKind === 'prediction') return ['CB02', 'AC01'];
  return ['AC01', 'CB03'];
}

const moveToFront = (list: ModuleId[], id: ModuleId) => (list.includes(id) ? [id, ...list.filter((x) => x !== id)] : list);
const moveToBack = (list: ModuleId[], id: ModuleId) => (list.includes(id) ? [...list.filter((x) => x !== id), id] : list);

export function pickVariant(entry: CatalogEntry, availableSec: number): VariantKey {
  const fitting = entry.variants.filter((v) => v.estimatedSec <= availableSec).sort((a, b) => b.estimatedSec - a.estimatedSec);
  return fitting[0]?.key ?? 'minimal';
}

/** 데이터가 쌓인 일수: 가장 오래된 세션 날짜부터 오늘까지. */
export function daysOfData(sessions: Session[], today: string): number {
  const dates = sessions.map((s) => s.localDate).sort();
  if (!dates.length) return 0;
  let n = 1;
  for (let d = dates[0]; d < today; d = addDays(d, 1)) n++;
  return n;
}

export function meanDelta(sessions: Session[], scale: string): { count: number; mean: number } {
  const usable = sessions.filter((s) => s.status === 'completed' && s.pre[scale] !== undefined && s.post[scale] !== undefined);
  if (!usable.length) return { count: 0, mean: 0 };
  return { count: usable.length, mean: usable.reduce((sum, s) => sum + (s.pre[scale] - s.post[scale]), 0) / usable.length };
}

export function recommend(input: RecommendInput): Recommendation {
  const { checkin, settings, now, catalog, history } = input;
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const today = localDate(now, settings.dayBoundaryHour);
  const state = resolveState(checkin, input.urgeAction);
  const reasonOverride = new Map<ModuleId, string>();

  // 2. 상태별 후보
  let list = [...CANDIDATES[state], ...(state === 'B' ? bThird(input) : [])];

  // 3. 개인 설정
  if (settings.groundingFirst) {
    list = moveToBack(moveToBack(list, 'BR01'), 'BR02');
    if (state === 'A') list = moveToFront(list.includes('GR01') ? list : [...list, 'GR01'], 'GR01');
    reasonOverride.set('GR01', '호흡보다 주변 감각에 집중하는 게 더 편하다고 하셨죠.');
  }
  if (settings.md01Disabled) list = list.filter((m) => m !== 'MD01');
  if (state === 'E' && checkin.energy <= 2) list = moveToFront(list.filter((m) => m !== 'MD01'), 'CB05');

  // 5. 반복 기록 감지
  if (state === 'B' && (history.maxThoughtRecordCount ?? 0) >= 3) {
    list = moveToFront(moveToBack(list, 'CB02'), 'AC01').filter((m) => m !== 'DB03');
    list.splice(1, 0, 'DB03');
    reasonOverride.set('AC01', '이 생각은 이미 여러 번 따져 보셨어요. 이번엔 거리를 두는 방법을 해볼 수 있어요.');
  }

  // 앱에 들어 있는 모듈만 남기고, 모자라면 채운다
  list = [...new Set(list)].filter((m) => byId.has(m));
  const fallbackReason = new Set<ModuleId>();
  for (const m of FALLBACK) {
    if (list.length >= 3) break;
    if (byId.has(m) && !list.includes(m)) {
      list.push(m);
      fallbackReason.add(m);
    }
  }

  // 6. 반복 추천 방지
  const declinedToday = (m: ModuleId) =>
    history.recommendations.filter(
      (r) => r.localDate === today && r.chosen === 'declined' && [r.primary, ...r.alternatives].some((p) => p.module === m),
    ).length;
  for (const m of [...list]) if (declinedToday(m) >= 2) list = moveToBack(list, m);
  const lastSession = [...history.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  if (
    lastSession &&
    list.length > 1 &&
    lastSession.moduleId === list[0] &&
    now.getTime() - new Date(lastSession.startedAt).getTime() < 30 * 60_000
  ) {
    list = [...list.slice(1), list[0]];
  }

  // 7. 개인화 (14일 이후, 설계 3.4)
  if (daysOfData(history.sessions, today) >= 14) {
    const checkinState = new Map(history.checkins.map((c) => [c.id, resolveState(c)]));
    const since = addDays(today, -27);
    const inState = history.sessions.filter(
      (s) => s.localDate >= since && s.checkinId && checkinState.get(s.checkinId) === state,
    );
    for (const m of [...list]) {
      const entry = byId.get(m)!;
      if (entry.kind === 'approach' || entry.kind === 'activation') continue;
      const stat = meanDelta(inState.filter((s) => s.moduleId === m), entry.mainScale);
      if (stat.count >= 5 && stat.mean < 1) list = moveToBack(list, m);
      if (stat.count >= 3 && stat.mean >= 2) {
        list = moveToFront(list, m);
        reasonOverride.set(m, `지난 몇 주 동안 이 연습을 했을 때 점수가 평균 ${stat.mean.toFixed(1)}점쯤 내려갔어요.`);
      }
    }
  }

  // A·D의 1순위는 항상 진정 기법 (몸 먼저)
  if ((state === 'A' || state === 'D') && byId.get(list[0])?.kind !== 'calming') {
    const firstCalming = list.find((m) => byId.get(m)?.kind === 'calming');
    if (firstCalming) list = moveToFront(list, firstCalming);
  }

  // 8~9. 버전과 이유
  const picks: RecPick[] = list.slice(0, 3).map((m, i) => {
    const entry = byId.get(m)!;
    const reason =
      reasonOverride.get(m) ??
      (i === 0 && !fallbackReason.has(m) ? STATE_REASON[state] : entry.summary);
    return { module: m, variant: pickVariant(entry, checkin.available), reason };
  });

  // 10. 진정 기법 과다 사용 안내 (다가가기 모듈이 있을 때만)
  let banner: string | undefined;
  if (byId.has('AC03')) {
    const since = addDays(today, -13);
    const recent = history.sessions.filter((s) => s.status === 'completed' && s.localDate >= since);
    const calming = recent.filter((s) => byId.get(s.moduleId)?.kind === 'calming').length;
    if (recent.length >= 5 && calming / recent.length >= 0.8) banner = CALMING_OVERUSE_BANNER;
  }

  return { state, primary: picks[0], alternatives: picks.slice(1), banner };
}

/** 홈의 "바로 시작" 카드 3개 (설계 7.2: 2번 탭 원칙). */
export function quickStartPicks(input: {
  settings: Settings;
  sessions: Session[];
  now: Date;
  catalog: CatalogEntry[];
}): ModuleId[] {
  const byId = new Map(input.catalog.map((c) => [c.id, c]));
  let defaults = ['BR01', 'GR01', 'DB02'].filter((m) => byId.has(m));
  if (input.settings.groundingFirst) defaults = moveToFront(defaults, 'GR01');
  const today = localDate(input.now, input.settings.dayBoundaryHour);
  if (daysOfData(input.sessions, today) < 14) return defaults.slice(0, 3);

  const minimal = input.sessions.filter((s) => s.variant === 'minimal');
  const ranked = input.catalog
    .map((c) => ({ id: c.id, ...meanDelta(minimal.filter((s) => s.moduleId === c.id), c.mainScale) }))
    .filter((r) => r.count >= 3)
    .sort((a, b) => b.mean - a.mean)
    .map((r) => r.id);
  return [...new Set([...ranked, ...defaults])].slice(0, 3);
}
