// IndexedDB 스키마 (설계 2.2). 기기 안에만 저장하고 외부로 보내지 않는다.
import Dexie, { type Table } from 'dexie';
import type { Assessment, Checkin, CrisisEvent, JournalEntry, RecommendationRecord, Session, Settings } from '../domain/types';

export interface MetaRow {
  key: string;
  value: unknown;
}

// 이후 작업(8~12)에서 채울 테이블도 스키마는 미리 만들어 둔다. 레코드 타입은 그 작업에서 정한다.
type Later = { id: string; createdAt: string; localDate: string } & Record<string, unknown>;

export class AppDB extends Dexie {
  checkins!: Table<Checkin, string>;
  sessions!: Table<Session, string>;
  recommendations!: Table<RecommendationRecord, string>;
  crisisEvents!: Table<CrisisEvent, string>;
  journalEntries!: Table<JournalEntry, string>;
  assessments!: Table<Assessment, string>;
  worryNotes!: Table<Later, string>;
  thoughts!: Table<Later, string>;
  approachTasks!: Table<Later, string>;
  approachAttempts!: Table<Later, string>;
  values!: Table<Later, string>;
  settings!: Table<Settings, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'meditation') {
    super(name);
    this.version(1).stores({
      checkins: 'id, localDate, createdAt',
      sessions: 'id, localDate, startedAt, moduleId, status, checkinId',
      recommendations: 'id, localDate, checkinId',
      crisisEvents: 'id, localDate',
      journalEntries: 'id, localDate',
      assessments: 'id, localDate, instrument',
      worryNotes: 'id, localDate',
      thoughts: 'id, createdAt',
      approachTasks: 'id, createdAt',
      approachAttempts: 'id, localDate, approachTaskId, status',
      values: 'id, createdAt',
      settings: 'id',
      meta: 'key',
    });
  }
}

export const SCHEMA_VERSION = 1;

let instance: AppDB | null = null;

export function getDB(): AppDB {
  instance ??= new AppDB();
  return instance;
}

/** 테스트에서 매번 새 데이터베이스를 쓰기 위해. */
export function setDB(db: AppDB | null) {
  instance = db;
}
