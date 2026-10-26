import type { TimeOfDay } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** 기기 시간대 기준 날짜. 하루의 경계는 새벽 4시라서 새벽 1시 기록은 전날이 된다 (설계 2.1). */
export function localDate(date: Date, boundaryHour = 4): string {
  const shifted = new Date(date.getTime() - boundaryHour * 3_600_000);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
}

export function timeOfDay(date: Date): TimeOfDay {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 18) return 'day';
  if (h >= 18 && h < 23) return 'evening';
  return 'night';
}

/** 시간대 오프셋을 포함한 ISO 문자열 (예: 2026-11-02T14:20:11+09:00). */
export function isoWithOffset(date: Date): string {
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** localDate 문자열에서 n일을 더하거나 뺀다. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n, 12);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function stamp(now: Date, boundaryHour = 4) {
  return { createdAt: isoWithOffset(now), localDate: localDate(now, boundaryHour), timeOfDay: timeOfDay(now) };
}
