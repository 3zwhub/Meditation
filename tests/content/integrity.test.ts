// 콘텐츠끼리 서로 맞물리는지 (작업 7 완료 기준)
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { affirmationSchema, lexiconSchema, moduleSchema } from '../../src/content/schema';
import { EVENING_CLOSINGS } from '../../src/domain/routines';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const modules = readdirSync('content/modules').map((f) => moduleSchema.parse(read(`content/modules/${f}`)));
const ids = new Set(modules.map((m) => m.id));
const lexicons = new Set(readdirSync('content/lexicon').map((f) => lexiconSchema.parse(read(`content/lexicon/${f}`)).id));

// 1단계 7.2: MVP 모듈 15개 + 저녁 기록
const MVP = ['BR01', 'BR02', 'GR01', 'MD01', 'MD02', 'CB01', 'CB02', 'CB03', 'CB05', 'AC01', 'AC03', 'DB01', 'DB02', 'DB03', 'AF01', 'JR01'];

describe('콘텐츠 연결', () => {
  it('MVP 모듈 16개가 모두 있다', () => {
    expect([...ids].sort()).toEqual([...MVP].sort());
  });

  it('다음 연결·대체 연습·피해야 할 때의 대안이 모두 있는 모듈을 가리킨다', () => {
    for (const m of modules) {
      const refs = [
        ...m.outro.next.flatMap((n) => (n.module ? [n.module] : [])),
        ...m.troubleshooting.flatMap((t) => (t.action ? [t.action] : [])),
        ...m.stopSignals.flatMap((s) => (s.action === 'crisis' ? [] : [s.action])),
        ...m.states.avoid.flatMap((a) => a.use),
      ];
      for (const r of refs) expect(ids.has(r), `${m.id} → ${r}`).toBe(true);
    }
  });

  it('다음 연결이 가리키는 버전이 그 모듈에 있다', () => {
    const byId = new Map(modules.map((m) => [m.id, m]));
    for (const m of modules) {
      for (const n of m.outro.next) {
        if (n.module && n.variant) expect(byId.get(n.module)!.variants[n.variant], `${m.id} → ${n.module}/${n.variant}`).toBeDefined();
      }
    }
  });

  it('어휘 목록 이름이 모두 있다', () => {
    for (const m of modules) {
      const steps = [...Object.values(m.variants).flatMap((v) => v!.steps), ...(m.outro.reflection ? [m.outro.reflection] : [])];
      for (const s of steps) {
        if (s.type !== 'choice') continue;
        expect(Boolean(s.options) !== Boolean(s.lexicon), `${m.id}/${s.id}: options와 lexicon 중 하나만`).toBe(true);
        if (s.lexicon) expect(lexicons.has(s.lexicon), `${m.id}/${s.id} → ${s.lexicon}`).toBe(true);
      }
    }
  });

  it('저녁 기록 모듈의 하루 점수 id가 저장 함수와 맞는다', () => {
    const jr = modules.find((m) => m.record === 'journal')!;
    for (const v of Object.values(jr.variants)) {
      const stepIds = v!.steps.map((s) => s.id);
      for (const id of ['dayAnxiety', 'dayMood', 'dayEnergy']) expect(stepIds).toContain(id);
    }
  });
});

describe('확언 (AF01)', () => {
  const list = affirmationSchema.array().parse(read('content/affirmations.json'));
  const doc = readFileSync('docs/02-modules/AF01.md', 'utf8');

  it('네 가지 형태에 걸쳐 19개', () => {
    expect(list).toHaveLength(19);
    expect(new Set(list.map((a) => a.form))).toEqual(new Set(['acceptance', 'process', 'value', 'compassion']));
    expect(new Set(list.map((a) => a.id)).size).toBe(list.length);
  });

  it('문장과 약한 버전이 2단계 문서와 같다', () => {
    for (const a of list) {
      expect(doc, a.text).toContain(`| ${a.text} | ${a.weaker} |`);
    }
  });

  it('{가치}가 들어간 문장은 needs에 value가 있다', () => {
    for (const a of list) if (a.text.includes('{가치}')) expect(a.needs).toContain('value');
  });
});

describe('저녁 마무리 문장 (JR01)', () => {
  it('2단계 문서와 같다', () => {
    const doc = readFileSync('docs/02-modules/JR01.md', 'utf8');
    for (const c of EVENING_CLOSINGS) expect(doc).toContain(c);
  });
});
