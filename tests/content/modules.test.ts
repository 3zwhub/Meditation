// 콘텐츠 형식 검사와 2단계 문서(원본)와의 일치 검사 (설계 1.1, 8.1 작업 3).
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isValidExpression } from '../../src/domain/conditions';
import { moduleSchema, type ModuleContent, type Step } from '../../src/content/schema';

const files = readdirSync('content/modules').filter((f) => f.endsWith('.json'));
const modules: ModuleContent[] = files.map((f) => moduleSchema.parse(JSON.parse(readFileSync(`content/modules/${f}`, 'utf8'))));

// 문서의 강조 표시(**), 쉼 표시, 줄바꿈과 인용 기호(>)를 지우고 공백을 하나로 맞춘다.
const normalize = (s: string) =>
  s.replace(/\*\*/g, '').replace(/\(쉼 \d+초\)/g, ' ').replace(/^>\s?/gm, '').replace(/\s+/g, ' ').trim();

function stepTexts(step: Step): string[] {
  if (step.type === 'say' || step.type === 'exit') return [step.text];
  if (step.type === 'pacer') return [...(step.cues ?? []).map((c) => c.text), ...(step.cycleCues ?? []).flatMap((c) => Object.values(c))];
  return [];
}

describe.each(modules.map((m) => [m.id, m] as const))('%s', (id, m) => {
  const doc = normalize(readFileSync(`docs/02-modules/${id}.md`, 'utf8'));

  it('파일 이름과 ID가 같다', () => {
    expect(files).toContain(`${id}.json`);
  });

  it('조건식이 모두 문법에 맞는다', () => {
    const exprs = [
      ...m.outro.next.map((n) => n.if),
      ...m.states.avoid.map((a) => a.when),
      ...Object.values(m.variants).flatMap((v) => v!.steps.flatMap((s) => ('showIf' in s && s.showIf ? [s.showIf] : []))),
    ];
    for (const e of exprs) expect(isValidExpression(e), e).toBe(true);
  });

  it('스텝 id가 버전 안에서 겹치지 않는다', () => {
    for (const v of Object.values(m.variants)) {
      const ids = v!.steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('안내 문장이 2단계 문서와 같다', () => {
    const texts = [
      ...m.intro,
      m.outro.message,
      ...m.troubleshooting.map((t) => t.problem),
      ...Object.values(m.variants).flatMap((v) => v!.steps.flatMap(stepTexts)),
    ];
    for (const t of texts) {
      // {자리 표시}는 코드의 변수 이름과 문서의 한국어 이름이 다르므로, 그 사이의 고정된 부분만 비교한다
      const parts = normalize(t).split(/\{[^}]+\}/).map((p) => p.trim()).filter((p) => p.length >= 2);
      for (const p of parts) expect(doc, `문서에 없는 문장: ${t}`).toContain(p);
    }
  });

  it('위기로 연결되는 멈춤 신호가 있다', () => {
    expect(m.stopSignals.some((s) => s.action === 'crisis')).toBe(true);
  });
});
