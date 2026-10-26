import type { CatalogEntry } from '../domain/recommend';
import {
  affirmationSchema,
  assessmentSchema,
  lexiconSchema,
  moduleSchema,
  sequenceSchema,
  type Affirmation,
  type AssessmentContent,
  type Lexicon,
  type ModuleContent,
  type SequenceContent,
  type Step,
} from './schema';

// content/ 아래 JSON을 빌드에 포함한다 (서비스 워커가 함께 캐시).
const rawModules = import.meta.glob('../../content/modules/*.json', { eager: true, import: 'default' });
const rawLexicons = import.meta.glob('../../content/lexicon/*.json', { eager: true, import: 'default' });
const rawAffirmations = import.meta.glob('../../content/affirmations.json', { eager: true, import: 'default' });
const rawAssessments = import.meta.glob('../../content/assessments/*.json', { eager: true, import: 'default' });
const rawSequences = import.meta.glob('../../content/sequences.json', { eager: true, import: 'default' });

function parseAll<T>(raw: Record<string, unknown>, parse: (d: unknown) => { success: true; data: T } | { success: false; error: { issues: unknown } }): T[] {
  return Object.entries(raw).flatMap(([path, data]) => {
    const r = parse(data);
    if (r.success) return [r.data];
    // 형식이 틀린 파일은 빼고 나머지로 동작한다. 테스트에서 먼저 걸러지므로 배포본에서는 일어나지 않아야 한다.
    console.error(`콘텐츠 형식 오류: ${path}`, r.error.issues);
    return [];
  });
}

export const LEXICONS = new Map<string, Lexicon>(parseAll(rawLexicons, (d) => lexiconSchema.safeParse(d)).map((l) => [l.id, l]));

/** choice 단계의 lexicon을 공용 목록의 options로 바꾼다. */
export function expandLexicon(step: Step, lexicons: Map<string, Lexicon> = LEXICONS): Step {
  if (step.type !== 'choice' || !step.lexicon) return step;
  const lex = lexicons.get(step.lexicon);
  if (!lex) throw new Error(`없는 어휘 목록: ${step.lexicon}`);
  return { ...step, options: lex.options };
}

export function expandModule(m: ModuleContent, lexicons: Map<string, Lexicon> = LEXICONS): ModuleContent {
  const variants = Object.fromEntries(
    Object.entries(m.variants).map(([k, v]) => [k, v && { ...v, steps: v.steps.map((s) => expandLexicon(s, lexicons)) }]),
  ) as ModuleContent['variants'];
  const reflection = m.outro.reflection && expandLexicon(m.outro.reflection, lexicons);
  return { ...m, variants, outro: { ...m.outro, reflection } };
}

export const MODULES = new Map<string, ModuleContent>(
  parseAll(rawModules, (d) => moduleSchema.safeParse(d))
    .flatMap((m) => {
      try {
        return [expandModule(m)];
      } catch (e) {
        console.error(`콘텐츠 형식 오류: ${m.id}`, e);
        return [];
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => [m.id, m]),
);

export const AFFIRMATIONS: Affirmation[] = parseAll(rawAffirmations, (d) => affirmationSchema.array().safeParse(d)).flat();

export function getModule(id: string): ModuleContent | undefined {
  return MODULES.get(id);
}

export function catalog(): CatalogEntry[] {
  return [...MODULES.values()].map((m) => ({
    id: m.id,
    kind: m.kind,
    mainScale: m.postMeasure?.id ?? 'mood',
    summary: m.summary,
    variants: (['minimal', 'basic', 'extended'] as const).flatMap((key) => {
      const v = m.variants[key];
      return v ? [{ key, estimatedSec: v.estimatedSec }] : [];
    }),
  }));
}

export const ASSESSMENTS = new Map<string, AssessmentContent>(
  parseAll(rawAssessments, (d) => assessmentSchema.safeParse(d)).map((a) => [a.id, a]),
);

/** 공식 한국어판 문항이 들어 있어 실시할 수 있는지. */
export const assessmentReady = (a: AssessmentContent | undefined) => Boolean(a?.items && a.options && a.instruction && a.source);

export const SEQUENCES: SequenceContent[] = parseAll(rawSequences, (d) => sequenceSchema.array().safeParse(d))
  .flat()
  // 들어 있는 모듈만으로 이루어진 시퀀스만 쓴다
  .filter((q) => q.steps.every((st) => MODULES.has(st.module)));

export const sequenceForState = (state: string) => SEQUENCES.find((q) => q.state === state);
