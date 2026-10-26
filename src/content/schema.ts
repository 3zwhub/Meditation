// 콘텐츠 형식 (설계 1.3). 앱 시작 시와 테스트에서 content/ JSON을 이 스키마로 검사한다.
import { z } from 'zod';

const id = z.string().min(1);
const stateId = z.enum(['A', 'B', 'C', 'D', 'E', 'F']);

const option = z.object({ value: z.string(), label: z.string() });

const phase = z.object({ phase: z.enum(['in', 'in2', 'hold', 'out']), sec: z.number().positive() });

export const stepSchema = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('say'), text: z.string().min(1), pauseSec: z.number().nonnegative().optional(), emphasis: z.boolean().optional() }),
  z.object({
    id,
    type: z.literal('pacer'),
    pattern: z.array(phase).min(1),
    cycles: z.number().int().positive(),
    // cycleCues: 앞쪽 몇 번의 주기에서 단계마다 보여줄 문장. 그 뒤로는 기본 문구(들이쉬기·내쉬기)
    cycleCues: z.array(z.record(z.string(), z.string())).optional(),
    // cues: 이 단계 시작부터 atSec초에 보여줄 문장
    cues: z.array(z.object({ atSec: z.number().nonnegative(), text: z.string() })).optional(),
  }),
  z.object({ id, type: z.literal('timer'), sec: z.number().positive(), label: z.string(), skippable: z.boolean().optional() }),
  z.object({ id, type: z.literal('scale'), label: z.string(), min: z.number().default(0), max: z.number().default(10), optional: z.boolean().optional() }),
  z.object({ id, type: z.literal('choice'), label: z.string(), options: z.array(option).min(2), multi: z.boolean().optional(), optional: z.boolean().optional() }),
  z.object({
    id,
    type: z.literal('text'),
    label: z.string(),
    placeholder: z.string().optional(),
    example: z.string().optional(),
    optional: z.boolean().optional(),
    showIf: z.string().optional(),
  }),
]);

const variant = z.object({
  durationLabel: z.string(),
  estimatedSec: z.number().positive(),
  steps: z.array(stepSchema).min(1),
});

const measure = z.object({ id, label: z.string() });

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
  preMeasure: measure,
  postMeasure: measure,
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
export type ModuleContent = z.infer<typeof moduleSchema>;
export type VariantContent = z.infer<typeof variant>;
