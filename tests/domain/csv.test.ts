import { describe, expect, it } from 'vitest';
import { csvCell, journalCsv, sessionsCsv, toCsv } from '../../src/domain/csv';
import type { JournalEntry, Session } from '../../src/domain/types';

describe('CSV', () => {
  it('쉼표·따옴표·줄바꿈을 감싼다', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('그는 "네"라고')).toBe('"그는 ""네""라고"');
    expect(csvCell('줄\n바꿈')).toBe('"줄\n바꿈"');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(['A', 'B'])).toBe('A|B');
  });
  it('엑셀용 BOM과 CRLF', () => {
    expect(toCsv(['a'], [[1]])).toBe('﻿a\r\n1\r\n');
  });
  it('"점수만"이면 자유 입력 글을 뺀다', () => {
    const j = { localDate: '2026-11-02', createdAt: 'x', anxiety: 5, mood: 4, energy: 3, oneLine: '비밀 일기', response: ['avoided'] } as JournalEntry;
    expect(journalCsv([j], true)).not.toContain('비밀 일기');
    expect(journalCsv([j], false)).toContain('비밀 일기');
    const s = {
      localDate: '2026-11-02', createdAt: 'x', startedAt: 'x', moduleId: 'CB02', variant: 'minimal', status: 'completed', entry: 'search',
      pre: { anxiety: 7 }, post: { anxiety: 4 }, answers: { prediction: '비밀 생각' },
    } as unknown as Session;
    const scores = sessionsCsv([s], true);
    expect(scores).not.toContain('비밀 생각');
    expect(scores).toContain('anxiety,7,4');
    expect(sessionsCsv([s], false)).toContain('비밀 생각');
  });
});
