// 콘텐츠 형식 (설계 1.3). 앱 시작 시와 테스트에서 content/ JSON을 이 스키마로 검사한다.
import { z } from 'zod';

const id = z.string().min(1);
const stateId = z.enum(['A', 'B', 'C', 'D', 'E', 'F']);

const option = z.object({ value: z.string(), label: z.string(), hint: z.string().optional() });

const phase = z.object({ phase: z.enum(['in', 'in2', 'hold', 'out']), sec: z.number().positive() });

// 모든 단계는 showIf로 조건부로 보여줄 수 있다 (설계 1.5의 조건식).
const base = { id, showIf: z.string().optional() };

export const stepSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('say'), text: z.string().min(1), pauseSec: z.number().nonnegative().optional(), emphasis: z.boolean().optional() }),
  z.object({
    ...base,
    type: z.literal('pacer'),
    pattern: z.array(phase).min(1),
    cycles: z.number().int().positive(),
    // cycleCues: 앞쪽 몇 번의 주기에서 단계마다 보여줄 문장. 그 뒤로는 기본 문구(들이쉬기·내쉬기)
    cycleCues: z.array(z.record(z.string(), z.string())).optional(),
    // cues: 이 단계 시작부터 atSec초에 보여줄 문장
    cues: z.array(z.object({ atSec: z.number().nonnegative(), text: z.string() })).optional(),
  }),
  z.object({ ...base, type: z.literal('timer'), sec: z.number().positive(), label: z.string(), skippable: z.boolean().optional() }),
  z.object({
    ...base,
    type: z.literal('scale'),
    label: z.string(),
    min: z.number().default(0),
    max: z.number().default(10),
    optional: z.boolean().optional(),
    // 이 점수 이하를 고르면 위기 버튼을 강조한다 (설계 5.2: 기분 0~2점)
    crisisEmphasisAtOrBelow: z.number().optional(),
  }),
  z.object({
    ...base,
    type: z.literal('choice'),
    label: z.string(),
    // options 또는 lexicon(content/lexicon/*.json의 공용 목록) 중 하나. lexicon은 불러올 때 options로 바뀐다
    options: z.array(option).min(2).optional(),
    lexicon: z.string().optional(),
    multi: z.boolean().optional(),
    maxSelect: z.number().int().positive().optional(),
    optional: z.boolean().optional(),
    // 이 설정 값으로 미리 고르고, 고르면 설정에 기억한다 (MD02의 호흡/소리)
    setting: z.literal('meditationAnchor').optional(),
  }),
  z.object({
    ...base,
    type: z.literal('text'),
    label: z.string(),
    placeholder: z.string().optional(),
    example: z.string().optional(),
    optional: z.boolean().optional(),
    // 확언(AF01)에서 적어 둔 내 가치를 참고로 보여준다 (1단계 7.2의 9번)
    showMyValue: z.boolean().optional(),
  }),
  // 모듈을 여기서 끝낸다 (DB03의 "불안이 사실에 맞는 경우" 등). 보통 showIf와 함께 쓴다
  z.object({ ...base, type: z.literal('exit'), text: z.string().min(1) }),
  // CB03: 걱정 한 줄을 걱정 메모로 저장
  z.object({ ...base, type: z.literal('worryMemo'), label: z.string(), example: z.string().optional() }),
  // CB03: 오늘의 걱정 메모를 다시 보고 분류
  z.object({ ...base, type: z.literal('worryReview') }),
  // AF01: 상태에 맞는 확언 하나와 믿는 정도, 3점 미만이면 더 약한 버전
  z.object({ ...base, type: z.literal('affirmation') }),
  // DB01: 처음 사용할 때 한 번 하는 안전 확인. 이미 했으면 건너뛴다
  z.object({ ...base, type: z.literal('tippScreening') }),
  // JR01: 오늘 앱에서 한 것 자동 요약
  z.object({ ...base, type: z.literal('todaySummary') }),
  // CB02: 이전에 기록한 생각과 같은지 고른다 (같은 생각 반복 기록 감지, 1단계 5장). 고르면 fillInto 단계에 그 생각을 채운다
  z.object({ ...base, type: z.literal('thoughtSelect'), fillInto: id }),
]);

const variant = z.object({
  durationLabel: z.string(),
  estimatedSec: z.number().positive(),
  steps: z.array(stepSchema).min(1),
  // 이 버전만 마무리 문장이 다를 때 (CB03 걱정 메모처럼 버전마다 하는 일이 다른 경우)
  outroMessage: z.string().optional(),
});

// crisisEmphasisAtOrBelow: 이 점수 이하를 고르면 위기 버튼을 강조한다 (CB05 시작 화면의 기분 0~2점 등)
const measure = z.object({ id, label: z.string(), crisisEmphasisAtOrBelow: z.number().optional() });

export const moduleSchema = z.object({
  id: z.string().regex(/^[A-Z]{2}\d{2}$/),
  contentVersion: z.number().int().positive(),
  name: z.string(),
  summary: z.string(),
  category: z.enum(['breath', 'grounding', 'meditation', 'cbt', 'act', 'dbt', 'journal', 'affirmation']),
  mechanisms: z.array(z.enum(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'])).min(1),
  states: z.object({
    suitable: z.array(stateId).min(1),
    avoid: z.array(z.object({ when: z.string(), use: z.array(id), reason: z.string() })),
  }),
  kind: z.enum(['calming', 'cognitive', 'approach', 'activation', 'reflective']),
  evidence: z.object({ level: z.enum(['strong', 'moderate', 'preliminary', 'hypothesis']), note: z.string() }),
  intro: z.array(z.string()).min(1),
  // 저녁 기록(JR01)처럼 전후 점수가 없는 모듈은 비워 둔다
  preMeasure: measure.optional(),
  postMeasure: measure.optional(),
  // 완료하면 이 모듈의 답을 따로 저장할 곳 (src/player/records.ts)
  record: z.enum(['journal', 'thought', 'approach', 'value']).optional(),
  variants: z.object({ minimal: variant, basic: variant, extended: variant.optional() }),
  outro: z.object({
    message: z.string(),
    reflection: stepSchema.optional(),
    next: z.array(z.object({ if: z.string(), module: id.optional(), variant: z.enum(['minimal', 'basic', 'extended']).optional(), action: z.literal('returnToTask').optional() })),
  }),
  troubleshooting: z.array(
    z.object({ problem: z.string(), answer: z.string(), action: id.optional(), setSetting: z.enum(['groundingFirst', 'md01Disabled']).optional() }),
  ),
  stopSignals: z.array(z.object({ text: z.string(), action: z.union([id, z.literal('crisis')]) })),
  references: z.array(z.string()).optional(),
});

export type Step = z.infer<typeof stepSchema>;
export type StepType = Step['type'];
export type ModuleContent = z.infer<typeof moduleSchema>;
export type VariantContent = z.infer<typeof variant>;

export const lexiconSchema = z.object({ id, options: z.array(option).min(2) });

export const affirmationSchema = z.object({
  id: z.string().regex(/^AF-(ACC|PRO|VAL|COM)-\d{2}$/),
  form: z.enum(['acceptance', 'process', 'value', 'compassion']),
  text: z.string().min(1),
  weaker: z.string().min(1),
  states: z.array(stateId),
  // 가치형의 {가치}, {할 일} 자리. 값이 없으면 이 확언은 고르지 않는다
  needs: z.array(z.enum(['value', 'task'])).optional(),
});

export type Lexicon = z.infer<typeof lexiconSchema>;
export type Affirmation = z.infer<typeof affirmationSchema>;

// GAD-7·PHQ-9 (설계 4장). 문항·지시문·선택지는 공식 한국어판을 글자 그대로 옮긴다. 비어 있으면 화면은 "준비 중"을 보여준다.
export const assessmentSchema = z
  .object({
    id: z.enum(['GAD7', 'PHQ9']),
    name: z.string(),
    fullName: z.string(),
    itemCount: z.number().int().positive(),
    safetyItem: z.number().int().positive().optional(),
    TODO: z.string().optional(),
    source: z.object({ title: z.string(), url: z.string(), retrievedAt: z.string() }).nullable(),
    instruction: z.string().nullable(),
    options: z.array(z.string()).length(4).nullable(),
    items: z.array(z.string().min(1)).nullable(),
    reference: z.string(),
    bands: z
      .array(z.object({ min: z.number(), max: z.number(), label: z.string(), message: z.string(), recommend: z.enum(['none', 'suggest', 'strong']) }))
      .min(1),
  })
  .refine((a) => !a.items || a.items.length === a.itemCount, '문항 수가 itemCount와 달라요')
  .refine((a) => !a.items || (a.source && a.instruction && a.options), '문항이 있으면 출처·지시문·선택지도 있어야 해요');

export type AssessmentContent = z.infer<typeof assessmentSchema>;

// 조합 시퀀스 (2단계 sequences.md). if는 체크인 값으로 정하는 갈림길이다 (설계 1.5 조건식).
export const sequenceSchema = z.object({
  id: z.string().regex(/^SEQ\d$/),
  state: stateId,
  title: z.string(),
  duration: z.string(),
  why: z.string(),
  end: z.string(),
  steps: z.array(z.object({ module: id, variant: z.enum(['minimal', 'basic', 'extended']), if: z.string().optional() })).min(2),
});

export type SequenceContent = z.infer<typeof sequenceSchema>;
