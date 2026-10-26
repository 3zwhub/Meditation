// 시퀀스의 실제 순서: 갈림길(if)을 체크인 값으로 정한다. 체크인이 없으면 값이 없는 것으로 본다.
import { evaluate } from './conditions';
import type { Checkin, VariantKey } from './types';

export interface SequenceLike {
  steps: { module: string; variant: VariantKey; if?: string }[];
}

export function sequenceSteps(seq: SequenceLike, checkin?: Pick<Checkin, 'anxiety' | 'mood' | 'energy' | 'thoughtKind' | 'states'>) {
  const scope = { checkin: checkin ?? {} };
  return seq.steps.filter((st) => !st.if || evaluate(st.if, scope));
}
