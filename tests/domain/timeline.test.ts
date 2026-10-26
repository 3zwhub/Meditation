import { describe, expect, it } from 'vitest';
import { fillTemplate, pacerFrame, stepDuration } from '../../src/player/timeline';

describe('진행 시간', () => {
  it('호흡 단계 길이 = 주기 길이 × 횟수', () => {
    expect(stepDuration({ id: 'p', type: 'pacer', cycles: 3, pattern: [{ phase: 'in', sec: 2 }, { phase: 'in2', sec: 1 }, { phase: 'out', sec: 5 }] })).toBe(24);
  });
  it('입력 단계는 저절로 넘어가지 않는다', () => {
    expect(stepDuration({ id: 'x', type: 'text', label: 'a' })).toBeNull();
  });
  it('안내 문장은 쉼만큼 더 머문다', () => {
    const base = stepDuration({ id: 's', type: 'say', text: '짧은 문장' })!;
    expect(stepDuration({ id: 's', type: 'say', text: '짧은 문장', pauseSec: 5 })).toBeCloseTo(base - 1 + 5);
  });
});

describe('호흡 원', () => {
  const pattern = [{ phase: 'in' as const, sec: 4 }, { phase: 'out' as const, sec: 6 }];
  it('주기와 단계를 시각으로 계산한다', () => {
    expect(pacerFrame(pattern, 1)).toMatchObject({ cycle: 0, phase: 'in' });
    expect(pacerFrame(pattern, 5)).toMatchObject({ cycle: 0, phase: 'out' });
    expect(pacerFrame(pattern, 23)).toMatchObject({ cycle: 2, phase: 'in' });
  });
  it('들이쉬면 커지고 내쉬면 작아진다', () => {
    expect(pacerFrame(pattern, 0).size).toBeCloseTo(0.55);
    expect(pacerFrame(pattern, 3.99).size).toBeGreaterThan(0.85);
    expect(pacerFrame(pattern, 9.99).size).toBeLessThan(0.56);
  });
});

describe('문장 채우기', () => {
  it('현재 시각과 입력값', () => {
    expect(fillTemplate('지금 나는 여기, {현재 시각}에 있어요.', {}, new Date(2026, 0, 1, 9, 5))).toBe('지금 나는 여기, 9시 05분에 있어요.');
    expect(fillTemplate('시작 점수 {before}', { before: 7 })).toBe('시작 점수 7');
    expect(fillTemplate('{없는값} 그대로', {})).toBe('{없는값} 그대로');
  });
});
