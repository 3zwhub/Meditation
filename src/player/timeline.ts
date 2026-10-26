// 모듈 진행 시간 계산. 시각 기준으로 계산해서 화면이 꺼졌다 켜져도 어긋나지 않는다 (설계 7.5).
import type { Step } from '../content/schema';

const DEFAULT_PAUSE = 1;
const READ_CHARS_PER_SEC = 7;

/** 저절로 넘어가는 단계의 길이(초). 입력 단계는 null. */
export function stepDuration(step: Step): number | null {
  switch (step.type) {
    case 'say':
      return Math.max(2.5, step.text.length / READ_CHARS_PER_SEC) + (step.pauseSec ?? DEFAULT_PAUSE);
    case 'pacer':
      return step.pattern.reduce((s, p) => s + p.sec, 0) * step.cycles;
    case 'timer':
      return step.sec;
    default:
      return null;
  }
}

export interface PacerFrame {
  cycle: number;
  phase: 'in' | 'in2' | 'hold' | 'out';
  phaseRemaining: number;
  size: number; // 0.55 ~ 1
}

const SIZE_AFTER: Record<PacerFrame['phase'], number | null> = { in: 0.88, in2: 1, hold: null, out: 0.55 };

/** 호흡 원의 현재 상태. */
export function pacerFrame(pattern: { phase: PacerFrame['phase']; sec: number }[], elapsedSec: number): PacerFrame {
  const cycleLen = pattern.reduce((s, p) => s + p.sec, 0);
  const cycle = Math.floor(elapsedSec / cycleLen);
  let t = elapsedSec - cycle * cycleLen;
  let size = 0.55;
  for (const p of pattern) {
    const target = SIZE_AFTER[p.phase] ?? size;
    if (t < p.sec) {
      const progress = t / p.sec;
      const eased = 0.5 - Math.cos(Math.PI * progress) / 2;
      return { cycle, phase: p.phase, phaseRemaining: p.sec - t, size: size + (target - size) * eased };
    }
    t -= p.sec;
    size = target;
  }
  const last = pattern[pattern.length - 1];
  return { cycle, phase: last.phase, phaseRemaining: 0, size };
}

export const PHASE_LABEL: Record<PacerFrame['phase'], string> = {
  in: '들이쉬기',
  in2: '한 번 더',
  hold: '멈추기',
  out: '내쉬기',
};

/** {현재 시각}, {before}, 입력 id를 채운다. */
export function fillTemplate(text: string, vars: Record<string, unknown>, now = new Date()): string {
  return text.replace(/\{([^}]+)\}/g, (whole, key: string) => {
    if (key === '현재 시각') return `${now.getHours()}시 ${String(now.getMinutes()).padStart(2, '0')}분`;
    const v = vars[key];
    return v === undefined || v === '' ? whole : String(v);
  });
}
