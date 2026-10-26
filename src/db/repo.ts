// 저장소 함수. 화면은 테이블을 직접 다루지 않고 이 함수들을 쓴다.
import { addDays, localDate, stamp } from '../domain/day';
import {
  APPROACHED,
  DEFAULT_SETTINGS,
  type ApproachAttempt,
  type ApproachTask,
  type Thought,
  type ValueRecord,
  type Checkin,
  type CrisisEvent,
  type JournalEntry,
  type RecommendationRecord,
  type Session,
  type SessionEntry,
  type Settings,
  type VariantKey,
  type WorryNote,
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

export async function today(now = new Date()) {
  const { dayBoundaryHour } = await getSettings();
  return localDate(now, dayBoundaryHour);
}

// ---- 걱정 메모 (CB03) ----

export async function addWorryNote(text: string, now = new Date()): Promise<WorryNote> {
  const { dayBoundaryHour } = await getSettings();
  const note: WorryNote = { id: newId(), ...stamp(now, dayBoundaryHour), text, repeatCount: 1 };
  await getDB().worryNotes.add(note);
  return note;
}

export async function listWorryNotes(day: string): Promise<WorryNote[]> {
  return (await getDB().worryNotes.where('localDate').equals(day).toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateWorryNote(id: string, patch: Partial<WorryNote>) {
  await getDB().worryNotes.update(id, patch);
}

// ---- 저녁 기록 (JR01) ----

export async function addJournalEntry(data: Omit<JournalEntry, 'id' | 'createdAt' | 'localDate' | 'timeOfDay'>, now = new Date()) {
  const { dayBoundaryHour } = await getSettings();
  const entry: JournalEntry = { id: newId(), ...stamp(now, dayBoundaryHour), ...data };
  await getDB().journalEntries.add(entry);
  return entry;
}

/** 오늘 앱에서 한 것 (JR01 자동 요약). */
export async function todayActivity(now = new Date()) {
  const day = await today(now);
  const db = getDB();
  const [sessions, worryNoteCount, attempts] = await Promise.all([
    db.sessions.where('localDate').equals(day).filter((s) => s.status === 'completed').toArray(),
    db.worryNotes.where('localDate').equals(day).count(),
    db.approachAttempts.where('localDate').equals(day).filter((a) => APPROACHED.includes(a.status)).toArray(),
  ]);
  return {
    sessions: sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    worryNoteCount,
    approached: attempts.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

// ---- 생각 (CB02·AC01) ----

export async function listThoughts(limit = 5): Promise<Thought[]> {
  const all = await getDB().thoughts.toArray();
  return all.sort((a, b) => (b.lastRecordedAt ?? b.createdAt).localeCompare(a.lastRecordedAt ?? a.createdAt)).slice(0, limit);
}

export async function countThoughts() {
  return getDB().thoughts.count();
}

/** 새 생각을 저장하거나, 고른 이전 생각을 갱신한다. CB02로 기록할 때만 recordCount가 오른다. */
export async function saveThought(
  data: { thoughtId?: string; text?: string; storyTitle?: string; patterns?: string[]; belief?: number; fromCB02: boolean },
  now = new Date(),
): Promise<string | undefined> {
  const db = getDB();
  const at = now.toISOString();
  const existing = data.thoughtId ? await db.thoughts.get(data.thoughtId) : undefined;
  if (existing) {
    await db.thoughts.update(existing.id, {
      recordCount: existing.recordCount + (data.fromCB02 ? 1 : 0),
      lastRecordedAt: data.fromCB02 ? at : existing.lastRecordedAt,
      lastBelief: data.belief ?? existing.lastBelief,
      storyTitle: data.storyTitle ?? existing.storyTitle,
      patterns: [...new Set([...existing.patterns, ...(data.patterns ?? [])])],
    });
    return existing.id;
  }
  if (!data.text) return undefined;
  const t: Thought = {
    id: newId(),
    createdAt: at,
    text: data.text,
    storyTitle: data.storyTitle,
    patterns: data.patterns ?? [],
    recordCount: data.fromCB02 ? 1 : 0,
    lastRecordedAt: data.fromCB02 ? at : undefined,
    lastBelief: data.belief,
  };
  await db.thoughts.add(t);
  return t.id;
}

/** 최근 14일 안에 CB02로 기록한 생각 중 가장 많이 기록한 횟수 (설계 3.2의 5번). */
export async function maxRecentThoughtRecordCount(now = new Date(), days = 14): Promise<number> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const recent = await getDB().thoughts.filter((t) => (t.lastRecordedAt ?? '') >= since).toArray();
  return Math.max(0, ...recent.map((t) => t.recordCount));
}

// ---- 다가가기 (DB03·AC03) ----

const sameTitle = (a: string, b: string) => a.trim().replace(/\s+/g, ' ') === b.trim().replace(/\s+/g, ' ');

/** 같은 제목의 다가가고 싶은 일이 있으면 다시 쓰고(사다리 갱신), 없으면 만든다. */
export async function upsertApproachTask(title: string, ladder?: ApproachTask['ladder'], now = new Date()): Promise<ApproachTask> {
  const db = getDB();
  const found = (await db.approachTasks.toArray()).find((t) => !t.archived && sameTitle(t.title, title));
  if (found) {
    if (ladder?.length) {
      await db.approachTasks.update(found.id, { ladder });
      return { ...found, ladder };
    }
    return found;
  }
  const task: ApproachTask = { id: newId(), createdAt: now.toISOString(), title: title.trim(), ladder: ladder ?? [], archived: false };
  await db.approachTasks.add(task);
  return task;
}

export async function addApproachAttempt(
  data: Omit<ApproachAttempt, 'id' | 'createdAt' | 'localDate' | 'timeOfDay'>,
  now = new Date(),
): Promise<ApproachAttempt> {
  const { dayBoundaryHour } = await getSettings();
  const attempt: ApproachAttempt = { id: newId(), ...stamp(now, dayBoundaryHour), ...data };
  await getDB().approachAttempts.add(attempt);
  if (data.ladderStep && APPROACHED.includes(data.status)) await getDB().approachTasks.update(data.approachTaskId, { currentStep: data.ladderStep });
  return attempt;
}

/** 예정된 다가가기의 결과를 기록한다. 결과를 기록한 날이 다가간 날이다. */
export async function completeApproachAttempt(id: string, patch: Partial<ApproachAttempt>, now = new Date()) {
  const { dayBoundaryHour } = await getSettings();
  const db = getDB();
  const attempt = await db.approachAttempts.get(id);
  if (!attempt) return;
  const next = { ...patch, ...(patch.status && APPROACHED.includes(patch.status) ? stamp(now, dayBoundaryHour) : {}) };
  await db.approachAttempts.update(id, next);
  if (attempt.ladderStep && patch.status && APPROACHED.includes(patch.status)) {
    await db.approachTasks.update(attempt.approachTaskId, { currentStep: attempt.ladderStep });
  }
}

export async function getApproachAttempt(id: string) {
  return getDB().approachAttempts.get(id);
}

export async function getApproachTask(id: string) {
  return getDB().approachTasks.get(id);
}

export async function plannedApproachAttempts(): Promise<ApproachAttempt[]> {
  return (await getDB().approachAttempts.where('status').equals('planned').toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---- 내 가치 (AF01) ----

export async function addValue(data: Omit<ValueRecord, 'id' | 'createdAt'>, now = new Date()): Promise<ValueRecord> {
  const v: ValueRecord = { id: newId(), createdAt: now.toISOString(), ...data };
  await getDB().values.add(v);
  return v;
}

export async function latestValue(): Promise<ValueRecord | undefined> {
  const all = await getDB().values.toArray();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

// ---- 걱정 메모 다시 오기 ----

export async function bumpWorryNote(id: string) {
  const db = getDB();
  const note = await db.worryNotes.get(id);
  if (note) await db.worryNotes.update(id, { repeatCount: note.repeatCount + 1 });
}

// ---- 아침·저녁 루틴 (작업 9) ----

export interface TodayTask {
  day: string;
  text: string;
  source: 'tomorrowTask' | 'ladder' | 'worry' | 'own';
  approachTaskId?: string;
}

export async function setTodayTask(task: Omit<TodayTask, 'day'>, now = new Date()) {
  await setMeta('todayTask', { ...task, day: await today(now) } satisfies TodayTask);
}

export async function getTodayTask(now = new Date()): Promise<TodayTask | undefined> {
  const t = await getMeta<TodayTask>('todayTask');
  return t && t.day === (await today(now)) ? t : undefined;
}

/** 아침 "오늘 다가갈 작은 일" 후보의 재료. */
export async function todayTaskSources(now = new Date()) {
  const day = await today(now);
  const yesterday = addDays(day, -1);
  const db = getDB();
  const [journals, approachTasks, notes] = await Promise.all([
    db.journalEntries.where('localDate').between(yesterday, day, true, true).toArray(),
    db.approachTasks.toArray(),
    db.worryNotes.where('localDate').between(yesterday, day, true, true).toArray(),
  ]);
  const lastJournal = journals.filter((j) => j.localDate === yesterday).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return {
    tomorrowTask: lastJournal?.tomorrowTask,
    approachTasks: approachTasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    worryActions: notes.filter((n) => n.controllable === 'yes' && n.nextAction).map((n) => n.nextAction!),
  };
}

/** 오늘 저녁 기록의 "내일 다가가 볼 일"을 적는다 (저녁 루틴 마무리). */
export async function setTomorrowTask(text: string, now = new Date()) {
  const day = await today(now);
  const latest = (await getDB().journalEntries.where('localDate').equals(day).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (latest) await getDB().journalEntries.update(latest.id, { tomorrowTask: text });
}

/** 홈 "오늘" 카드 (설계 7.2). */
export async function todayStatus(now = new Date()) {
  const day = await today(now);
  const db = getDB();
  const [checkins, journals, sessions] = await Promise.all([
    db.checkins.where('localDate').equals(day).toArray(),
    db.journalEntries.where('localDate').equals(day).count(),
    db.sessions.where('localDate').equals(day).filter((s) => s.moduleId === 'AF01' && s.status === 'completed').toArray(),
  ]);
  const lastAffirmation = sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const aff = lastAffirmation?.answers.affirmation as { affirmationId?: string; usedWeaker?: boolean } | undefined;
  return {
    morningDone: checkins.some((c) => c.source === 'morning'),
    eveningDone: journals > 0,
    affirmation: aff?.affirmationId ? { id: aff.affirmationId, weaker: Boolean(aff.usedWeaker) } : undefined,
    todayTask: await getTodayTask(now),
  };
}
