import { beforeEach, describe, expect, it } from 'vitest';
import { AppDB, setDB } from '../../src/db/db';
import { addCheckin, getSettings, recentHistory, startSession, updateSession, updateSettings } from '../../src/db/repo';

let n = 0;
beforeEach(() => {
  setDB(new AppDB(`test-${++n}`));
});

describe('저장소', () => {
  it('설정이 없으면 기본값, 바꾸면 저장된다', async () => {
    expect((await getSettings()).groundingFirst).toBe(false);
    await updateSettings({ groundingFirst: true });
    expect((await getSettings()).groundingFirst).toBe(true);
  });

  it('체크인에 날짜·시간대가 붙고, 새벽 기록은 전날로 저장된다', async () => {
    const c = await addCheckin(
      { anxiety: 6, mood: 4, energy: 3, states: ['B'], available: 180, source: 'manual' },
      new Date(2026, 10, 3, 2, 0),
    );
    expect(c.localDate).toBe('2026-11-02');
    expect(c.timeOfDay).toBe('night');
  });

  it('세션을 시작하고 끝내면 최근 기록에 나온다', async () => {
    const now = new Date(2026, 10, 2, 14, 0);
    const s = await startSession({ moduleId: 'BR01', contentVersion: 1, variant: 'minimal', entry: 'quickStart' }, now);
    await updateSession(s.id, { status: 'completed', pre: { anxiety: 7 }, post: { anxiety: 5 } });
    const h = await recentHistory(now);
    expect(h.sessions).toHaveLength(1);
    expect(h.sessions[0]).toMatchObject({ moduleId: 'BR01', status: 'completed', post: { anxiety: 5 } });
  });

  it('28일보다 오래된 기록은 최근 기록에서 빠진다', async () => {
    const old = new Date(2026, 9, 1, 12, 0);
    await startSession({ moduleId: 'BR01', contentVersion: 1, variant: 'minimal', entry: 'quickStart' }, old);
    expect((await recentHistory(new Date(2026, 10, 20, 12, 0))).sessions).toHaveLength(0);
  });
});
