// 5단계 점검용 CSV (설계 6.3). "점수만"이면 자유 입력 글(저널·걱정·생각)을 뺀다.
import type { ApproachAttempt, Assessment, Checkin, JournalEntry, Session } from './types';

/** 쉼표·따옴표·줄바꿈이 든 값은 따옴표로 감싼다 (RFC 4180). */
export function csvCell(v: unknown): string {
  if (v === undefined || v === null) return '';
  const s = Array.isArray(v) ? v.join('|') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // 엑셀에서 한글이 깨지지 않도록 BOM을 붙인다
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const byDate = <T extends { createdAt: string }>(xs: T[]) => [...xs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export function checkinsCsv(rows: Checkin[]): string {
  return toCsv(
    ['날짜', '시각', '시간대', '불안', '기분', '에너지', '상태', '가용시간(초)', '종류'],
    byDate(rows).map((c) => [c.localDate, c.createdAt, c.timeOfDay, c.anxiety, c.mood, c.energy, c.states, c.available, c.source]),
  );
}

export function sessionsCsv(rows: Session[], scoresOnly: boolean): string {
  const header = ['날짜', '시작', '끝', '모듈', '버전', '상태', '시작 방법', '점수 종류', '시작 전', '끝난 뒤', '멈춘 이유'];
  return toCsv(
    scoresOnly ? header : [...header, '답(JSON)'],
    byDate(rows).map((s) => {
      const scale = Object.keys({ ...s.pre, ...s.post })[0];
      const base = [s.localDate, s.startedAt, s.endedAt, s.moduleId, s.variant, s.status, s.entry, scale, scale && s.pre[scale], scale && s.post[scale], s.stopReason];
      return scoresOnly ? base : [...base, s.answers];
    }),
  );
}

export function journalCsv(rows: JournalEntry[], scoresOnly: boolean): string {
  const header = ['날짜', '불안', '기분', '에너지', '그때 한 것'];
  const text = ['한 줄', '불안했던 순간', '덧붙인 말', '다가간 일·좋았던 일', '내 역할', '내일 할 일'];
  return toCsv(
    scoresOnly ? header : [...header, ...text],
    byDate(rows).map((j) => {
      const base = [j.localDate, j.anxiety, j.mood, j.energy, j.response];
      return scoresOnly ? base : [...base, j.oneLine, j.anxiousMoment, j.responseNote, j.good, j.goodRole, j.tomorrowTask];
    }),
  );
}

export function assessmentsCsv(rows: Assessment[]): string {
  return toCsv(
    ['날짜', '척도', '총점', '구간', '9번', '문항별 점수'],
    byDate(rows).map((a) => [a.localDate, a.instrument, a.total, a.band, a.item9, a.answers]),
  );
}

export function attemptsCsv(rows: ApproachAttempt[], scoresOnly: boolean): string {
  const header = ['날짜', '상태', '사다리 단계', '확신(%)', '예상이 일어났나', '가장 높았던 불안'];
  const text = ['행동', '예상', '실제 결과', '알게 된 것'];
  return toCsv(
    scoresOnly ? header : [...header, ...text],
    byDate(rows).map((a) => {
      const base = [a.localDate, a.status, a.ladderStep, a.confidence, a.predictionCameTrue, a.peakAnxiety];
      return scoresOnly ? base : [...base, a.action, a.prediction, a.outcome, a.learned];
    }),
  );
}
