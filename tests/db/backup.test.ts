// 작업 12 완료 기준: 내보내기 → 삭제 → 가져오기 후 데이터 동일
import { beforeEach, describe, expect, it } from 'vitest';
import { BACKUP_TABLES, deleteAllData, exportBackup, importBackup, parseBackup } from '../../src/db/backup';
import { AppDB, getDB, setDB } from '../../src/db/db';
import { addCheckin, addJournalEntry, addWorryNote, getSettings, setMeta, startSession, updateSettings } from '../../src/db/repo';
import { saveRecords } from '../../src/player/records';
import { getModule } from '../../src/content/load';

let n = 0;
beforeEach(() => setDB(new AppDB(`backup-${++n}`)));

async function seed() {
  await updateSettings({ groundingFirst: true, worryTime: '21:30' });
  await addCheckin({ anxiety: 6, mood: 4, energy: 3, states: ['B'], available: 180, source: 'manual' });
  const s = await startSession({ moduleId: 'BR01', contentVersion: 1, variant: 'minimal', entry: 'quickStart' });
  await getDB().sessions.update(s.id, { status: 'completed', pre: { anxiety: 7 }, post: { anxiety: 5 }, answers: { r1: '어깨, "턱"' } });
  await addJournalEntry({ anxiety: 5, mood: 5, energy: 5, oneLine: '줄바꿈\n있는 글' });
  await addWorryNote('평가 걱정');
  await saveRecords(getModule('DB03')!, 'minimal', { task: '메일', firstStep: '첫 문장', did: 'done' }, { stopped: false });
  await setMeta('todayTask', { day: '2026-11-02', text: '메일' });
  await setMeta('lastBackupAt', '2026-11-01T00:00:00Z');
}

async function snapshot() {
  const out: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    const rows = (await getDB().table(t).toArray()) as Record<string, unknown>[];
    out[t] = rows.sort((a, b) => String(a.id ?? a.key).localeCompare(String(b.id ?? b.key)));
  }
  return out;
}

describe('백업', () => {
  it('내보내기 → 전체 삭제 → 가져오기(바꾸기) 후 데이터가 같다 (기기 전용 정보 제외)', async () => {
    await seed();
    const before = await snapshot();
    const text = JSON.stringify(await exportBackup());
    await deleteAllData();
    for (const t of BACKUP_TABLES) expect(await getDB().table(t).count(), t).toBe(0);
    await importBackup(parseBackup(text), 'replace');
    const after = await snapshot();
    before.meta = before.meta.filter((m) => (m as { key: string }).key !== 'lastBackupAt');
    expect(after).toEqual(before);
  });

  it('합치기: 같은 id는 덮어쓰지 않고, 지금 설정을 유지한다', async () => {
    await seed();
    const backup = await exportBackup();
    await getDB().checkins.toCollection().modify({ anxiety: 9 });
    await updateSettings({ groundingFirst: false });
    backup.tables.checkins.push({ ...backup.tables.checkins[0], id: 'new-one' });
    const { added } = await importBackup(backup, 'merge');
    expect(added).toBe(1);
    const checkins = await getDB().checkins.toArray();
    expect(checkins).toHaveLength(2);
    expect(checkins.find((c) => c.id !== 'new-one')!.anxiety).toBe(9);
    expect((await getSettings()).groundingFirst).toBe(false);
  });

  it('이 앱의 백업이 아니면 거부한다', () => {
    expect(() => parseBackup('not json')).toThrow(/읽을 수 없어요/);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow(/형식이 아니에요/);
    expect(() => parseBackup(JSON.stringify({ app: 'meditation', schemaVersion: 99, exportedAt: '', tables: {} }))).toThrow(/새로운 버전/);
  });

  it('빠진 테이블은 빈 목록으로 읽는다 (예전 백업)', () => {
    const b = parseBackup(JSON.stringify({ app: 'meditation', schemaVersion: 1, exportedAt: '', tables: { checkins: [] } }));
    expect(b.tables.values).toEqual([]);
  });
});
