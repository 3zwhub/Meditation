import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assessmentSchema } from '../../src/content/schema';
import { assessmentDue, persistentLowMood, scoreAssessment } from '../../src/domain/assessments';
import { addDays } from '../../src/domain/day';

const gad = assessmentSchema.parse(JSON.parse(readFileSync('content/assessments/gad7.json', 'utf8')));
const phq = assessmentSchema.parse(JSON.parse(readFileSync('content/assessments/phq9.json', 'utf8')));

describe('점수 구간 (설계 4.2)', () => {
  it('GAD-7 구간 경계: 0~4 / 5~9 / 10~14 / 15~21', () => {
    expect(scoreAssessment([0, 0, 0, 0, 0, 0, 0], gad.bands).band.label).toBe('최소');
    expect(scoreAssessment([1, 1, 1, 1, 0, 0, 0], gad.bands).band.label).toBe('최소');
    expect(scoreAssessment([1, 1, 1, 1, 1, 0, 0], gad.bands).band.label).toBe('가벼움');
    expect(scoreAssessment([2, 2, 2, 2, 2, 0, 0], gad.bands).band).toMatchObject({ label: '중간', recommend: 'suggest' });
    expect(scoreAssessment([3, 3, 3, 3, 3, 0, 0], gad.bands).band).toMatchObject({ label: '심함', recommend: 'strong' });
    expect(scoreAssessment([3, 3, 3, 3, 3, 3, 3], gad.bands).total).toBe(21);
  });
  it('PHQ-9 구간 경계: 9점은 가벼움, 10점부터 전문가 안내, 15점부터 강조', () => {
    expect(scoreAssessment([1, 1, 1, 1, 1, 1, 1, 1, 1], phq.bands).band.recommend).toBe('none');
    expect(scoreAssessment([2, 1, 1, 1, 1, 1, 1, 1, 1], phq.bands).band.recommend).toBe('suggest');
    expect(scoreAssessment([3, 2, 2, 2, 2, 2, 2, 0, 0], phq.bands).band.recommend).toBe('strong');
    expect(scoreAssessment([3, 3, 3, 3, 3, 3, 3, 3, 3], phq.bands).band.label).toBe('심함');
  });
  it('구간이 0점부터 최대점까지 빈틈없이 이어진다', () => {
    for (const a of [gad, phq]) {
      const max = a.itemCount * 3;
      for (let t = 0; t <= max; t++) expect(a.bands.filter((b) => t >= b.min && t <= b.max), `${a.id} ${t}점`).toHaveLength(1);
    }
  });
  it('0~3점 밖의 응답은 거부한다', () => {
    expect(() => scoreAssessment([4, 0, 0, 0, 0, 0, 0], gad.bands)).toThrow();
  });
});

describe('실시 주기 (설계 4.1)', () => {
  it('한 번도 안 했거나 14일이 지나면 실시할 때', () => {
    expect(assessmentDue(undefined, '2026-11-20')).toBe(true);
    expect(assessmentDue({ localDate: '2026-11-07' }, '2026-11-20')).toBe(false);
    expect(assessmentDue({ localDate: '2026-11-06' }, '2026-11-20')).toBe(true);
  });
  it('기분·에너지 4점 이하가 14일 연속이면 PHQ-9 제안', () => {
    const today = '2026-11-20';
    const low = new Map<string, boolean>(Array.from({ length: 14 }, (_, i) => [addDays(today, -i), true]));
    expect(persistentLowMood(low, today)).toBe(true);
    low.set(addDays(today, -5), false);
    expect(persistentLowMood(low, today)).toBe(false);
  });
});

describe('콘텐츠 상태', () => {
  it('문항이 비어 있으면 TODO가 남아 있다 (직접 번역하지 않는다)', () => {
    for (const a of [gad, phq]) if (!a.items) expect(a.TODO).toContain('TODO(content)');
  });
  it('PHQ-9의 안전 문항은 9번', () => {
    expect(phq.safetyItem).toBe(9);
  });
});
