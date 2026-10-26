// 모듈 진행 화면 (설계 7.2): 시작 전 점수 → 단계 → 종료 점수 → 마무리 → 다음 연결
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getModule } from '../content/load';
import type { ModuleContent, Step } from '../content/schema';
import { countThoughts, getSettings, logCrisisEvent, startSession, updateRecommendation, updateSession, updateSettings } from '../db/repo';
import { evaluate } from '../domain/conditions';
import type { SessionEntry, Settings, StateId, VariantKey } from '../domain/types';
import { CRISIS_EVENT, useCrisisEmphasis } from '../safety/CrisisButton';
import { ScaleButtons } from '../ui/inputs';
import { carryForward, saveRecords } from './records';
import { AffirmationView, ThoughtSelectView, TippScreeningView, TodaySummaryView, WorryMemoView, WorryReviewView } from './SpecialSteps';
import { InputView, PacerView, SayView, TimerView, useWakeLock } from './StepViews';
import { stepDuration } from './timeline';

export interface PlayerContext {
  entry: SessionEntry;
  checkinId?: string;
  fromSessionId?: string;
  recommendationId?: string;
  state?: StateId;
  /** 앞 모듈에서 넘겨받은 값 (표준 키). 같은 id의 단계가 있으면 미리 채운다. */
  carry?: Record<string, unknown>;
}

type Phase = 'pre' | 'steps' | 'post' | 'outro' | 'stopped';

const VARIANT_LABEL: Record<VariantKey, string> = { minimal: '최소', basic: '기본', extended: '확장' };

const INPUT_TYPES = new Set<Step['type']>(['scale', 'choice', 'text']);

/** 답이 채워졌는지. 전용 단계는 각자 답을 남긴 뒤에 넘어갈 수 있다. */
function isAnswered(step: Step, value: unknown): boolean {
  switch (step.type) {
    case 'exit':
    case 'worryReview':
    case 'thoughtSelect':
    case 'todaySummary':
      return true;
    case 'affirmation': {
      const v = value as { affirmationBelief?: number; usedWeaker?: boolean; weakerBelief?: number } | undefined;
      return v?.affirmationBelief !== undefined && (!v.usedWeaker || v.weakerBelief !== undefined);
    }
    default:
      return value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);
  }
}

/** 답 없이 넘어갈 수 있는지 (선택 입력, 그리고 확언처럼 건너뛰어도 되는 단계). */
function isSkippable(step: Step): boolean {
  if (step.type === 'affirmation') return true;
  return 'optional' in step && Boolean(step.optional);
}

/** 문장 채우기용 값: 선택지는 값 대신 보이는 글자로. */
function templateVars(steps: Step[], answers: Record<string, unknown>): Record<string, unknown> {
  const vars: Record<string, unknown> = { ...answers };
  for (const s of steps) {
    if (s.type !== 'choice' || answers[s.id] === undefined) continue;
    const label = (v: unknown) => s.options?.find((o) => o.value === v)?.label ?? String(v);
    const a = answers[s.id];
    vars[s.id] = Array.isArray(a) ? a.map(label).join(', ') : label(a);
  }
  return vars;
}

export function ModulePlayer({ module, variant, context }: { module: ModuleContent; variant: VariantKey; context: PlayerContext }) {
  const navigate = useNavigate();
  const { setEmphasis } = useCrisisEmphasis();
  const v = module.variants[variant] ?? module.variants.minimal;
  const preId = module.preMeasure?.id;
  const postId = module.postMeasure?.id;
  const [phase, setPhase] = useState<Phase>('pre');
  const [pre, setPre] = useState<number | undefined>();
  const [post, setPost] = useState<number | undefined>();
  // 앞 모듈에서 넘겨받은 값 중 이 버전에 같은 id의 단계가 있는 것만 미리 채운다
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const ids = new Set(v.steps.map((st) => st.id));
    return Object.fromEntries(Object.entries(context.carry ?? {}).filter(([k]) => ids.has(k)));
  });
  const [hasThoughts, setHasThoughts] = useState(false);
  const [index, setIndex] = useState(0);
  const [stepStartedAt, setStepStartedAt] = useState(() => Date.now());
  const [helpOpen, setHelpOpen] = useState(false);
  // 조기 종료 단계(exit)로 끝났으면 마무리 문장(예: "한 걸음 다가갔어요")이 맞지 않으므로 숨긴다
  const [exited, setExited] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const sessionId = useRef<string | null>(null);
  const sessionReady = useRef<Promise<void> | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useWakeLock(phase === 'steps');

  // 세션은 화면이 열릴 때 만들고, 끝날 때 상태를 바꾼다.
  useEffect(() => {
    let cancelled = false;
    sessionReady.current = (async () => {
      try {
        const loaded = await getSettings();
        setSettings(loaded);
        // 설정에 기억해 둔 선택(MD02의 호흡/소리)을 미리 고른다
        const remembered = Object.fromEntries(
          v.steps.flatMap((st) => (st.type === 'choice' && st.setting ? [[st.id, loaded[st.setting]]] : [])),
        );
        setAnswers((a) => ({ ...remembered, ...a }));
        setHasThoughts((await countThoughts()) > 0);
        const s = await startSession({
          moduleId: module.id,
          contentVersion: module.contentVersion,
          variant,
          entry: context.entry,
          checkinId: context.checkinId,
          fromSessionId: context.fromSessionId,
        });
        if (cancelled) return;
        sessionId.current = s.id;
        if (context.recommendationId) await updateRecommendation(context.recommendationId, { sessionId: s.id });
      } catch (e) {
        // 저장이 안 돼도 연습은 할 수 있어야 한다
        console.error('세션을 저장하지 못했어요', e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // 세션은 화면을 열 때 한 번만 만든다 (v.steps는 module·variant에 따라 정해진다)
  }, [module.id, module.contentVersion, variant, context.entry, context.checkinId, context.fromSessionId, context.recommendationId]);

  // 화면을 떠나면 위기 버튼 강조를 되돌린다
  useEffect(() => () => setEmphasis(false), [setEmphasis]);

  const save = useCallback(async (patch: Parameters<typeof updateSession>[1]) => {
    await sessionReady.current;
    if (!sessionId.current) return;
    try {
      await updateSession(sessionId.current, patch);
    } catch (e) {
      console.error('세션을 저장하지 못했어요', e);
    }
  }, []);

  const preRecord = useCallback(() => (pre === undefined || !preId ? {} : { [preId]: pre }), [pre, preId]);

  const stop = useCallback(
    async (reason: 'user' | 'crisis' | 'stopSignal' | 'troubleshooting') => {
      if (phaseRef.current === 'stopped' || phaseRef.current === 'outro') return;
      setPhase('stopped');
      let extra: Record<string, unknown> = {};
      try {
        await sessionReady.current;
        extra = await saveRecords(module, variant, answers, { sessionId: sessionId.current ?? undefined, stopped: true });
      } catch (e) {
        console.error('기록을 저장하지 못했어요', e);
      }
      await save({ status: 'stopped', stopReason: reason, endedAt: new Date().toISOString(), answers: { ...answers, ...extra }, pre: preRecord() });
    },
    [answers, preRecord, save, module, variant],
  );

  // 위기 버튼을 누르면 진행 중인 모듈을 멈춤으로 저장한다 (설계 8.2-1)
  useEffect(() => {
    const onCrisis = () => void stop('crisis');
    window.addEventListener(CRISIS_EVENT, onCrisis);
    return () => window.removeEventListener(CRISIS_EVENT, onCrisis);
  }, [stop]);

  const scope = useMemo(
    () => ({
      pre: preRecord(),
      post: post === undefined || !postId ? {} : { [postId]: post },
      answer: answers,
      setting: settings ?? {},
    }),
    [preRecord, post, postId, answers, settings],
  );

  const visible = useCallback(
    (step: Step) => {
      if (step.type === 'tippScreening' && settings?.tippScreening.done) return false;
      if (step.type === 'thoughtSelect' && !hasThoughts) return false;
      return !step.showIf || evaluate(step.showIf, scope);
    },
    [scope, settings, hasThoughts],
  );

  /** 모든 단계를 마쳤을 때. */
  const finishSteps = useCallback(() => {
    if (postId) setPhase('post');
    else void complete(undefined);
    // complete는 아래에서 정의되며, 같은 렌더의 answers·pre를 쓰도록 의존성에 넣는다
  }, [postId, answers, pre]);

  /** 다음에 보여줄 단계로. 끝이면 종료 점수로. */
  const advanceFrom = useCallback(
    (from: number, startAt: number) => {
      let i = from + 1;
      while (i < v.steps.length && !visible(v.steps[i])) i++;
      if (i >= v.steps.length) {
        finishSteps();
        return;
      }
      setIndex(i);
      setStepStartedAt(startAt);
    },
    [v.steps, visible, finishSteps],
  );

  // 저절로 넘어가는 단계: 시각 기준으로 확인하고, 화면이 꺼졌다 돌아오면 지나간 단계를 건너뛴다.
  useEffect(() => {
    if (phase !== 'steps') return;
    const tick = () => {
      let i = index;
      let start = stepStartedAt;
      const now = Date.now();
      let moved = false;
      for (;;) {
        const dur = stepDuration(v.steps[i]);
        if (dur === null || now - start < dur * 1000) break;
        start += dur * 1000;
        let next = i + 1;
        while (next < v.steps.length && !visible(v.steps[next])) next++;
        moved = true;
        if (next >= v.steps.length) {
          finishSteps();
          return;
        }
        i = next;
        // 입력 단계에 도착하면 입력을 기다린다
        if (stepDuration(v.steps[i]) === null) {
          start = now;
          break;
        }
      }
      if (moved) {
        setIndex(i);
        setStepStartedAt(start);
      }
    };
    const id = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [phase, index, stepStartedAt, v.steps, visible, finishSteps]);

  const begin = () => {
    setPhase('steps');
    setStepStartedAt(Date.now());
    if (v.steps[0] && !visible(v.steps[0])) advanceFrom(0, Date.now());
    else setIndex(0);
  };

  async function complete(value: number | undefined) {
    setPost(value);
    setPhase('outro');
    let extra: Record<string, unknown> = {};
    try {
      await sessionReady.current;
      extra = await saveRecords(module, variant, answers, { sessionId: sessionId.current ?? undefined, stopped: false });
    } catch (e) {
      console.error('기록을 저장하지 못했어요', e);
    }
    if (Object.keys(extra).length) setAnswers((a) => ({ ...a, ...extra }));
    await save({
      status: 'completed',
      endedAt: new Date().toISOString(),
      pre: preRecord(),
      post: value === undefined || !postId ? {} : { [postId]: value },
      answers: { ...answers, ...extra },
    });
  }

  const setAnswer = (id: string, value: unknown) => setAnswers((a) => ({ ...a, [id]: value }));

  const emphasizeIfLow = (limit: number | undefined, value: number) => {
    if (limit !== undefined) setEmphasis(value <= limit);
  };

  const goTo = (moduleId: string, nextVariant: VariantKey) =>
    navigate(`/m/${moduleId}/${nextVariant}`, {
      replace: true,
      state: {
        entry: 'next',
        fromSessionId: sessionId.current ?? undefined,
        checkinId: context.checkinId,
        state: context.state,
        carry: carryForward(answers),
      } satisfies PlayerContext,
    });

  const header = (
    <div className="player-footer" style={{ marginBottom: 8 }}>
      {phase === 'steps' || phase === 'pre' ? (
        <button type="button" className="btn" onClick={() => void stop('user')}>
          ← 멈추기
        </button>
      ) : (
        <span />
      )}
      <span className="muted">
        {module.name} · {VARIANT_LABEL[variant]}
      </span>
    </div>
  );

  if (phase === 'stopped') {
    return (
      <div className="player">
        <div className="player-body">
          <p className="say">멈춰도 괜찮아요.</p>
          <p className="muted">여기까지 한 것도 연습이에요.</p>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/', { replace: true })}>
          홈으로
        </button>
      </div>
    );
  }

  if (phase === 'pre') {
    return (
      <div className="player">
        {header}
        <div className="player-body input">
          <h1>{module.name}</h1>
          {module.intro.map((t) => (
            <p key={t}>{t}</p>
          ))}
          <p className="muted">{v.durationLabel}</p>
          {module.preMeasure && (
            <ScaleButtons
              label={module.preMeasure.label}
              value={pre}
              onChange={(val) => {
                setPre(val);
                emphasizeIfLow(module.preMeasure?.crisisEmphasisAtOrBelow, val);
              }}
            />
          )}
        </div>
        <div className="stack">
          <button type="button" className="btn btn-primary btn-block" onClick={begin} disabled={!!module.preMeasure && pre === undefined}>
            시작하기
          </button>
          {module.preMeasure && (
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setPre(undefined);
                begin();
              }}
            >
              점수 없이 바로 시작
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'post' && module.postMeasure) {
    return (
      <div className="player">
        <div className="player-body input">
          <ScaleButtons
            label={module.postMeasure.label}
            value={post}
            onChange={(val) => {
              setPost(val);
              emphasizeIfLow(module.postMeasure?.crisisEmphasisAtOrBelow, val);
            }}
          />
          {pre !== undefined && preId === postId && <p className="muted">시작할 때: {pre}점</p>}
        </div>
        <div className="stack">
          <button type="button" className="btn btn-primary btn-block" disabled={post === undefined} onClick={() => void complete(post)}>
            다음
          </button>
          <button type="button" className="btn-link" onClick={() => void complete(undefined)}>
            건너뛰기
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'outro') {
    const suggestions = module.outro.next
      .filter((n) => n.module && n.module !== module.id && getModule(n.module) && evaluate(n.if, scope))
      .slice(0, 2);
    const reflection = module.outro.reflection;
    return (
      <div className="player">
        <div className="player-body input">
          {!exited && <p className="say" style={{ textAlign: 'left', margin: '0 0 24px' }}>{v.outroMessage ?? module.outro.message}</p>}
          {reflection && (reflection.type === 'choice' || reflection.type === 'text' || reflection.type === 'scale') && (
            <InputView
              step={reflection}
              value={answers[reflection.id]}
              onChange={(val) => {
                const next = { ...answers, [reflection.id]: val };
                setAnswers(next);
                void save({ answers: next });
              }}
            />
          )}
          {suggestions.length > 0 && <h2>이어서 해볼 수 있는 것</h2>}
          <div className="stack">
            {suggestions.map((n) => {
              const m = getModule(n.module!)!;
              return (
                <button key={m.id} type="button" className="btn btn-block" onClick={() => goTo(m.id, n.variant ?? 'minimal')}>
                  {m.name} · {m.variants[n.variant ?? 'minimal']?.durationLabel}
                </button>
              );
            })}
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/', { replace: true })}>
          하던 일로 돌아가기
        </button>
      </div>
    );
  }

  // phase === 'steps'
  const step = v.steps[index];
  const waits = stepDuration(step) === null;
  const answered = isAnswered(step, answers[step.id]);
  const skippable = isSkippable(step);
  const vars = { ...templateVars(v.steps, answers), before: pre };

  const forward = () => {
    if (step.type !== 'exit') return advanceFrom(index, Date.now());
    setExited(true);
    finishSteps();
  };
  const forwardLabel = step.type === 'exit' ? '마치기' : answered || !skippable ? '다음' : '건너뛰기';

  return (
    <div className="player">
      {header}
      <div className={`player-body${waits ? ' input' : ''}`} key={`${index}-${stepStartedAt}`}>
        {step.type === 'say' && <SayView text={step.text} emphasis={step.emphasis} vars={vars} />}
        {step.type === 'exit' && <SayView text={step.text} vars={vars} />}
        {step.type === 'pacer' && <PacerView step={step} startedAt={stepStartedAt} />}
        {step.type === 'timer' && <TimerView step={step} startedAt={stepStartedAt} />}
        {INPUT_TYPES.has(step.type) && (
          <InputView
            step={step as Extract<Step, { type: 'scale' | 'choice' | 'text' }>}
            value={answers[step.id]}
            onChange={(val) => {
              setAnswer(step.id, val);
              if (step.type === 'scale' && typeof val === 'number') emphasizeIfLow(step.crisisEmphasisAtOrBelow, val);
              if (step.type === 'choice' && step.setting === 'meditationAnchor' && (val === 'breath' || val === 'sound')) {
                void updateSettings({ meditationAnchor: val }).then(setSettings, () => {});
              }
            }}
          />
        )}
        {step.type === 'worryMemo' && (
          <WorryMemoView label={step.label} example={step.example} value={answers[step.id]} onChange={(val) => setAnswer(step.id, val)} />
        )}
        {step.type === 'worryReview' && <WorryReviewView onChange={(val) => setAnswer(step.id, val)} />}
        {step.type === 'affirmation' && (
          <AffirmationView state={context.state} settings={settings} value={answers[step.id]} onChange={(val) => setAnswer(step.id, val)} />
        )}
        {step.type === 'tippScreening' && <TippScreeningView onChange={(val) => setAnswer(step.id, val)} onSettings={setSettings} />}
        {step.type === 'todaySummary' && <TodaySummaryView onChange={(val) => setAnswer(step.id, val)} />}
        {step.type === 'thoughtSelect' && (
          <ThoughtSelectView
            value={answers[step.id]}
            onChange={(id, text) => setAnswers((a) => ({ ...a, [step.id]: id, ...(text ? { [step.fillInto]: text } : {}) }))}
          />
        )}
      </div>
      <div className="player-footer">
        <button type="button" className="btn" onClick={() => setHelpOpen(true)}>
          힘들어요
        </button>
        <div className="dots" aria-label={`${v.steps.length}단계 중 ${index + 1}단계`}>
          {v.steps.map((s, i) => (
            <span key={s.id} className={i <= index ? 'on' : ''} />
          ))}
        </div>
        {waits ? (
          <button type="button" className="btn btn-primary" disabled={!answered && !skippable} onClick={forward}>
            {forwardLabel}
          </button>
        ) : (
          <button type="button" className="btn" onClick={forward} aria-label="다음 단계로">
            다음 ›
          </button>
        )}
      </div>
      {helpOpen && (
        <HelpSheet
          module={module}
          onClose={() => setHelpOpen(false)}
          onGoTo={async (id, reason) => {
            await stop(reason);
            goTo(id, 'minimal');
          }}
          onCrisis={async () => {
            await stop('crisis');
            void logCrisisEvent('moduleStopSignal');
            navigate('/crisis');
          }}
          onSetSetting={async (key) => setSettings(await updateSettings({ [key]: true }))}
        />
      )}
    </div>
  );
}

/** "힘들어요": E. 문제가 생길 때와 즉시 멈춰야 하는 신호 */
function HelpSheet({
  module,
  onClose,
  onGoTo,
  onCrisis,
  onSetSetting,
}: {
  module: ModuleContent;
  onClose: () => void;
  onGoTo: (id: string, reason: 'stopSignal' | 'troubleshooting') => void;
  onCrisis: () => void;
  onSetSetting: (key: 'groundingFirst' | 'md01Disabled') => Promise<void>;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [settingSaved, setSettingSaved] = useState(false);
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="힘들 때 도움말" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>바로 멈춰야 할 때</h2>
        <div className="stack">
          {module.stopSignals.map((s) => (
            <button
              key={s.text}
              type="button"
              className="choice"
              onClick={() => (s.action === 'crisis' ? onCrisis() : onGoTo(s.action, 'stopSignal'))}
            >
              {s.text}
              <small>{s.action === 'crisis' ? '→ 위기 안내 열기' : `→ ${getModule(s.action)?.name ?? s.action}(으)로 바꾸기`}</small>
            </button>
          ))}
        </div>
        <h2>잘 안 될 때</h2>
        <div className="stack">
          {module.troubleshooting.map((t, i) => (
            <div key={t.problem}>
              <button type="button" className="choice" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} style={{ width: '100%' }}>
                {t.problem}
              </button>
              {open === i && (
                <div className="card" style={{ marginTop: 4 }}>
                  <p>{t.answer}</p>
                  <div className="row">
                    {t.action && getModule(t.action) && (
                      <button type="button" className="btn" onClick={() => onGoTo(t.action!, 'troubleshooting')}>
                        {getModule(t.action)!.name}(으)로 바꾸기
                      </button>
                    )}
                    {t.setSetting && (
                      <button
                        type="button"
                        className="btn"
                        disabled={settingSaved}
                        onClick={async () => {
                          await onSetSetting(t.setSetting!);
                          setSettingSaved(true);
                        }}
                      >
                        {settingSaved ? '앞으로 그렇게 할게요 ✓' : '앞으로 이렇게 바꿀까요?'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={onClose}>
          계속하기
        </button>
      </div>
    </div>
  );
}
