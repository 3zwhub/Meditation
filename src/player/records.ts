// 모듈을 마치거나 멈출 때, 다른 모듈과 화면이 쓰는 기록으로 옮겨 저장한다 (설계 2.3의 표준 키).
import type { ModuleContent } from '../content/schema';
import { addApproachAttempt, addJournalEntry, addValue, saveThought, upsertApproachTask } from '../db/repo';
import type { ApproachAttempt, JournalResponse } from '../domain/types';

type Answers = Record<string, unknown>;

const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const strs = (v: unknown) => (Array.isArray(v) ? (v as string[]) : undefined);

/** 다가가기 시도의 상태 (1단계 5장: 중간에 멈춘 시도도 다가간 일로 센다). */
export function attemptStatus(variant: string, a: Answers, sessionStopped: boolean): ApproachAttempt['status'] | null {
  if (a.danger === 'yes' || a.f1 === 'yes' || a.f2 === 'yes' || a.f3 === 'yes') return null; // 불안이 사실에 맞음: 시도가 아님
  if (variant === 'minimal') {
    if (a.did === 'done') return 'done';
    if (a.did === 'later') return 'planned';
    if (a.did === 'notNow') return 'skipped';
    return sessionStopped && a.firstStep ? 'stoppedMidway' : null;
  }
  if (a.go === 'later') return 'planned';
  if (a.go === 'now') return a.cameTrue ? 'done' : sessionStopped ? 'stoppedMidway' : 'done';
  return null;
}

export async function saveRecords(
  module: ModuleContent,
  variant: string,
  answers: Answers,
  ctx: { sessionId?: string; stopped: boolean },
): Promise<Answers> {
  switch (module.record) {
    case 'journal': {
      if (ctx.stopped) return {};
      const summary = answers.todaySummary as { sessions: string[]; worryNoteCount: number; approachAttemptIds?: string[] } | undefined;
      await addJournalEntry({
        anxiety: num(answers.dayAnxiety) ?? 0,
        mood: num(answers.dayMood) ?? 0,
        energy: num(answers.dayEnergy) ?? 0,
        oneLine: str(answers.oneLine),
        anxiousMoment: str(answers.anxiousMoment),
        response: strs(answers.response) as JournalResponse[] | undefined,
        responseNote: str(answers.responseNote),
        good: str(answers.good),
        goodRole: str(answers.goodRole),
        autoSummary: summary,
        tomorrowTask: str(answers.tomorrowTask),
      });
      return {};
    }
    case 'thought': {
      if (ctx.stopped) return {};
      const fromCB02 = module.id === 'CB02';
      const picked = typeof answers.thoughtSelect === 'string' && answers.thoughtSelect !== 'new' ? answers.thoughtSelect : undefined;
      const storyTitle = answers.storyTitle === 'other' ? str(answers.storyOther) : str(answers.storyTitle);
      const thoughtId = await saveThought({
        thoughtId: picked,
        text: str(answers.prediction) ?? str(answers.thought),
        storyTitle,
        patterns: strs(answers.patterns),
        belief: num(answers.beliefAfter),
        fromCB02,
      });
      return thoughtId ? { thoughtId } : {};
    }
    case 'approach': {
      const status = attemptStatus(variant, answers, ctx.stopped);
      const title = str(answers.task);
      if (!status || !title) return {};
      const ladder = [1, 2, 3].flatMap((n) => {
        const action = str(answers[`l${n}`]);
        return action ? [{ step: n, action, expectedAnxiety: num(answers[`l${n}a`]) }] : [];
      });
      const task = await upsertApproachTask(title, ladder);
      const ladderStep = Number(answers.ladderStep) || undefined;
      const action =
        (ladderStep ? str(answers[`l${ladderStep}`]) : undefined) ?? str(answers.smaller) ?? str(answers.firstStep) ?? title;
      const attempt = await addApproachAttempt({
        approachTaskId: task.id,
        sessionId: ctx.sessionId,
        action,
        ladderStep,
        firstStepOnly: variant === 'minimal',
        factCheck: answers.danger === 'unsure' ? 'unsure' : 'notDanger',
        prediction: str(answers.prediction),
        confidence: num(answers.confidence),
        safetyBehaviorDropped: str(answers.safetyBehavior) === 'none' ? undefined : str(answers.safetyBehavior),
        scheduledFor: str(answers.when),
        status,
        peakAnxiety: num(answers.peak),
        outcome: str(answers.outcome),
        predictionCameTrue: str(answers.cameTrue) as ApproachAttempt['predictionCameTrue'],
        learned: str(answers.learned),
      });
      return { approachAttemptId: attempt.id, approachTaskId: task.id };
    }
    case 'value': {
      if (ctx.stopped || !str(answers.value)) return {};
      const v = await addValue({ label: str(answers.value)!, why: str(answers.why), sentence: str(answers.sentence), belief: num(answers.sentenceBelief) });
      return { valueId: v.id };
    }
    default:
      return {};
  }
}

/** 다음 모듈로 넘겨줄 값 (설계 2.3 표준 키). 받는 모듈에 같은 id의 단계가 있으면 미리 채워진다. */
export function carryForward(answers: Answers): Answers {
  const carry: Answers = {};
  if (str(answers.task)) carry.task = answers.task;
  const emotions = strs(answers.emotions) ?? (str(answers.emotion) && answers.emotion !== 'other' ? [answers.emotion as string] : undefined);
  if (emotions) carry.emotions = emotions;
  if (strs(answers.bodyParts)) carry.bodyParts = answers.bodyParts;
  if (str(answers.sentence)) carry.why = answers.sentence; // AF01 가치 문장 → AC03 "이 일이 왜 중요한지"
  if (str(answers.thought)) carry.prediction = answers.thought; // AC01 생각 → CB02 예측
  return carry;
}
