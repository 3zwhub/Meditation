// 전체 백업·가져오기·삭제 (설계 6.3). 백업 파일을 저장한 곳의 보안은 사용자 몫이라고 화면에서 안내한다.
import { z } from 'zod';
import { getDB, SCHEMA_VERSION } from './db';

export const BACKUP_TABLES = [
  'checkins',
  'sessions',
  'recommendations',
  'crisisEvents',
  'journalEntries',
  'assessments',
  'worryNotes',
  'thoughts',
  'approachTasks',
  'approachAttempts',
  'values',
  'settings',
  'meta',
] as const;

type TableName = (typeof BACKUP_TABLES)[number];

const row = z.record(z.string(), z.unknown());

export const backupSchema = z.object({
  app: z.literal('meditation'),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  tables: z.object(Object.fromEntries(BACKUP_TABLES.map((t) => [t, z.array(row).default([])])) as Record<TableName, z.ZodDefault<z.ZodArray<typeof row>>>),
});

export type Backup = z.infer<typeof backupSchema>;

/** 백업 파일에 들어가지 않는 기기 상태 (다른 기기로 옮길 때 섞이면 안 되는 것). */
const LOCAL_ONLY_META = new Set(['lastBackupAt', 'lowMoodShownOn']);

export async function exportBackup(now = new Date()): Promise<Backup> {
  const db = getDB();
  const tables = {} as Backup['tables'];
  for (const t of BACKUP_TABLES) {
    const rows = (await db.table(t).toArray()) as Record<string, unknown>[];
    tables[t] = t === 'meta' ? rows.filter((r) => !LOCAL_ONLY_META.has(String(r.key))) : rows;
  }
  return { app: 'meditation', schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), tables };
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('백업 파일을 읽을 수 없어요. 이 앱에서 내보낸 JSON 파일인지 확인해 주세요.');
  }
  const r = backupSchema.safeParse(data);
  if (!r.success) throw new Error('이 앱의 백업 파일 형식이 아니에요.');
  if (r.data.schemaVersion > SCHEMA_VERSION) throw new Error('더 새로운 버전의 앱에서 만든 백업이에요. 앱을 새로 고친 뒤 다시 해보세요.');
  return r.data;
}

/**
 * merge: 지금 기록에 합친다. 같은 id는 덮어쓰지 않고, 설정은 지금 것을 유지한다.
 * replace: 지금 기록을 모두 지우고 백업으로 바꾼다.
 */
export async function importBackup(backup: Backup, mode: 'merge' | 'replace'): Promise<{ added: number }> {
  const db = getDB();
  let added = 0;
  await db.transaction('rw', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const t of BACKUP_TABLES) {
      const table = db.table(t);
      const rows = backup.tables[t];
      if (mode === 'replace') {
        await table.clear();
        await table.bulkAdd(rows);
        added += rows.length;
        continue;
      }
      if (t === 'settings') continue;
      const key = t === 'meta' ? 'key' : 'id';
      const existing = new Set((await table.toCollection().primaryKeys()) as string[]);
      const fresh = rows.filter((r) => !existing.has(String(r[key])));
      await table.bulkAdd(fresh);
      added += fresh.length;
    }
  });
  return { added };
}

/** 모든 기록을 지운다. 앱 파일(서비스 워커 캐시)은 그대로라 앱은 계속 쓸 수 있다. */
export async function deleteAllData() {
  const db = getDB();
  await db.transaction('rw', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const t of BACKUP_TABLES) await db.table(t).clear();
  });
}
