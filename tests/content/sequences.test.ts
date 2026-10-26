// 조합 시퀀스 (작업 14)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getModule } from '../../src/content/load';
import { sequenceSchema } from '../../src/content/schema';
import { isValidExpression } from '../../src/domain/conditions';
import { sequenceSteps } from '../../src/domain/sequences';

const seqs = sequenceSchema.array().parse(JSON.parse(readFileSync('content/sequences.json', 'utf8')));
const doc = readFileSync('docs/02-modules/sequences.md', 'utf8').replace(/\*\*/g, '');
const ids = (s: ReturnType<typeof sequenceSteps>) => s.map((x) => `${x.module}/${x.variant}`);
const get = (id: string) => seqs.find((s) => s.id === id)!;

describe('시퀀스 콘텐츠', () => {
  it('상태 A~E마다 하나씩 (2단계 정리 표)', () => {
    expect(seqs.map((s) => s.state)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
  it('모든 단계가 있는 모듈과 버전을 가리키고, 조건식이 문법에 맞는다', () => {
    for (const s of seqs) {
      for (const st of s.steps) {
        expect(getModule(st.module)?.variants[st.variant], `${s.id} → ${st.module}/${st.variant}`).toBeDefined();
        if (st.if) expect(isValidExpression(st.if), st.if).toBe(true);
      }
    }
  });
  it('앱 안내 문구와 마무리 문구가 2단계 문서와 같다', () => {
    for (const s of seqs) {
      expect(doc).toContain(`앱 안내 문구: ${s.why}`);
      expect(doc).toContain(`마무리 문구: ${s.end}`);
    }
  });
});

describe('갈림길', () => {
  it('시퀀스 2: 확인 가능한 예측이면 사고기록지, 아니면 탈융합', () => {
    expect(ids(sequenceSteps(get('SEQ2'), { anxiety: 5, mood: 5, energy: 5, states: ['B'], thoughtKind: 'prediction' }))).toEqual(['DB02/basic', 'CB01/basic', 'CB02/minimal']);
    expect(ids(sequenceSteps(get('SEQ2'), { anxiety: 5, mood: 5, energy: 5, states: ['B'], thoughtKind: 'whatIf' }))).toEqual(['DB02/basic', 'CB01/basic', 'AC01/minimal']);
    expect(ids(sequenceSteps(get('SEQ2')))).toEqual(['DB02/basic', 'CB01/basic', 'AC01/minimal']);
  });
  it('시퀀스 5: 에너지 0~2점이면 바디스캔을 건너뛴다 (2단계 수정 제안 17)', () => {
    expect(ids(sequenceSteps(get('SEQ5'), { anxiety: 3, mood: 2, energy: 2, states: ['E'] }))[0]).toBe('AF01/minimal');
    expect(ids(sequenceSteps(get('SEQ5'), { anxiety: 3, mood: 3, energy: 4, states: ['E'] }))[0]).toBe('MD01/minimal');
    expect(ids(sequenceSteps(get('SEQ5')))[0]).toBe('MD01/minimal');
  });
});
