// 저장소 함수. 화면은 테이블을 직접 다루지 않고 이 함수들을 쓴다.
import { addDays, localDate, stamp } from '../domain/day';
import {
  DEFAULT_SETTINGS,
  type Checkin,
  type CrisisEvent,
  type RecommendationRecord,
  type Session,
  type SessionEntry,
  type Settings,
  type VariantKey,
} from '../domain/types';
import { getDB } from './db';

export const newId = () => crypto.randomUUID();

export async function getSettings(): Promise<Settings> {
  return (await getDB().settings.get('settings')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch, id: 'settings' as const };
  await getDB().settings.put(next);
  return next;
}

export async function addCheckin(
  data: Pick<Checkin, 'anxiety' | 'mood' | 'energy' | 'states' | 'available' | 'thoughtKind' | 'source'>,
  now = new Date(),
): Promise<Checkin> {
  const { dayBoundaryHour } = await getSettings();
  const checkin: Checkin = { id: newId(), ...stamp(now, dayBoundaryHour), ...data };
  await getDB().checkins.add(checkin);
  return checkin;
}

export async function startSession(
  data: { moduleId: string; contentVersion: number; variant: VariantKey; entry: SessionEntry; checkinId?: string; fromSessionId?: string },
  now = new Date(),
): Promise<Session> {
  const { dayBoundaryHour } = await getSettings();
  const s = stamp(now, dayBoundaryHour);
  const session: Session = { id: newId(), ...s, startedAt: s.createdAt, status: 'inProgress', pre: {}, post: {}, answers: {}, ...data };
  await getDB().sessions.add(session);
  return session;
}

export async function updateSession(id: string, patch: Partial<Session>) {
  await getDB().sessions.update(id, patch);
}

export async function addRecommendation(data: Omit<RecommendationRecord, 'id' | 'createdAt' | 'localDate' | 'timeOfDay'>, now = new Date()) {
  const { dayBoundaryHour } = await getSettings();
  const rec: RecommendationRecord = { id: newId(), ...stamp(now, dayBoundaryHour), ...data };
  await getDB().recommendations.add(rec);
  return rec;
}

export async function updateRecommendation(id: string, patch: Partial<RecommendationRecord>) {
  await getDB().recommendations.update(id, patch);
}

export async function getRecommendation(id: string) {
  return getDB().recommendations.get(id);
}

/** 위기 화면이 열린 기록. 열린 이유 외의 내용은 저장하지 않는다 (설계 5.3). 실패해도 위기 화면은 열린다. */
export async function logCrisisEvent(trigger: CrisisEvent['trigger'], now = new Date()) {
  try {
    const { dayBoundaryHour } = await getSettings();
    await getDB().crisisEvents.add({ id: newId(), ...stamp(now, dayBoundaryHour), trigger });
  } catch {
    // 기록 실패가 위기 안내를 막으면 안 된다
  }
}

/** 추천과 안전 판정에 쓰는 최근 기록 (최근 28일). */
export async function recentHistory(now = new Date(), days = 28) {
  const { dayBoundaryHour } = await getSettings();
  const since = addDays(localDate(now, dayBoundaryHour), -(days - 1));
  const db = getDB();
  const [sessions, checkins, recommendations, journals] = await Promise.all([
    db.sessions.where('localDate').aboveOrEqual(since).toArray(),
    db.checkins.where('localDate').aboveOrEqual(since).toArray(),
    db.recommendations.where('localDate').aboveOrEqual(since).toArray(),
    db.journalEntries.where('localDate').aboveOrEqual(since).toArray(),
  ]);
  return { sessions, checkins, recommendations, journals };
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await getDB().meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await getDB().meta.put({ key, value });
}
