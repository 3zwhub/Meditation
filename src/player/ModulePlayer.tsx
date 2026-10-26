// 모듈 진행 화면 (설계 7.2): 시작 전 점수 → 단계 → 종료 점수 → 마무리 → 다음 연결
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getModule } from '../content/load';
import type { ModuleContent, Step } from '../content/schema';
import { getSettings, logCrisisEvent, startSession, updateRecommendation, updateSession, updateSettings } from '../db/repo';
import { evaluate } from '../domain/conditions';
import type { SessionEntry, Settings, VariantKey } from '../domain/types';
import { CRISIS_EVENT } from '../safety/CrisisButton';
import { ScaleButtons } from '../ui/inputs';
import { InputView, PacerView, SayView, TimerView, useWakeLock } from './StepViews';
import { stepDuration } from './timeline';

export interface PlayerContext {
  entry: SessionEntry;
  checkinId?: string;
  fromSessionId?: string;
  recommendationId?: string;
}

type Phase = 'pre' | 'steps' | 'post' | 'outro' | 'stopped';

const VARIANT_LABEL: Record<VariantKey, string> = { minimal: '최소', basic: '기본', extended: '확장' };

export function ModulePlayer({ module, variant, context }: { module: ModuleContent; variant: VariantKey; context: PlayerContext }) {
  const navigate = useNavigate();
  const v = module.variants[variant] ?? module.variants.minimal;
  const [phase, setPhase] = useState<Phase>('pre');
  const [pre, setPre] = useState<number | undefined>();
  const [post, setPost] = useState<number | undefined>();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [index, setIndex] = useState(0);
  const [stepStartedAt, setStepStartedAt] = useState(() => Date.now());
  const [helpOpen, setHelpOpen] = useState(false);
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
        setSettings(await getSettings());
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
  }, [module.id, module.contentVersion, variant, context.entry, context.checkinId, context.fromSessionId, context.recommendationId]);

  const save = useCallback(async (patch: Parameters<typeof updateSession>[1]) => {
    await sessionReady.current;
    if (!sessionId.current) return;
    try {
      await updateSession(sessionId.current, patch);
    } catch (e) {
      console.error('세션을 저장하지 못했어요', e);
    }
  }, []);

  const stop = useCallback(
    async (reason: 'user' | 'crisis' | 'stopSignal' | 'troubleshooting') => {
      if (phaseRef.current === 'stopped' || phaseRef.current === 'outro') return;
      setPhase('stopped');
      await save({ status: 'stopped', stopReason: reason, endedAt: new Date().toISOString(), answers, pre: pre === undefined ? {} : { [module.preMeasure.id]: pre } });
    },
    [answers, pre, module.preMeasure.id, save],
  );

  // 위기 버튼을 누르면 진행 중인 모듈을 멈춤으로 저장한다 (설계 8.2-1)
  useEffect(() => {
    const onCrisis = () => void stop('crisis');
    window.addEventListener(CRISIS_EVENT, onCrisis);
    return () => window.removeEventListener(CRISIS_EVENT, onCrisis);
  }, [stop]);

  const scope = useMemo(
    () => ({
      pre: pre === undefined ? {} : { [module.preMeasure.id]: pre },
      post: post === undefined ? {} : { [module.postMeasure.id]: post },
      answer: answers,
      setting: settings ?? {},
    }),
    [pre, post, answers, settings, module.preMeasure.id, module.postMeasure.id],
  );

  const visible = useCallback(
    (step: Step) => !('showIf' in step) || !step.showIf || evaluate(step.showIf, scope),
    [scope],
  );

  /** 다음에 보여줄 단계로. 끝이면 종료 점수로. */
  const advanceFrom = useCallback(
    (from: number, startAt: number) => {
      let i = from + 1;
      while (i < v.steps.length && !visible(v.steps[i])) i++;
      if (i >= v.steps.length) {
        setPhase('post');
        return;
      }
      setIndex(i);
      setStepStartedAt(startAt);
    },
    [v.steps, visible],
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
        const step = v.steps[i];
        const dur = stepDuration(step);
        if (dur === null || now - start < dur * 1000) break;
        start += dur * 1000;
        let next = i + 1;
        while (next < v.steps.length && !visible(v.steps[next])) next++;
        moved = true;
        if (next >= v.steps.length) {
          setPhase('post');
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
  }, [phase, index, stepStartedAt, v.steps, visible]);

  const begin = (skipPre: boolean) => {
    if (skipPre) setPre(undefined);
    setPhase('steps');
    setIndex(0);
    setStepStartedAt(Date.now());
    if (v.steps[0] && !visible(v.steps[0])) advanceFrom(0, Date.now());
  };

  const finishPost = async (value: number | undefined) => {
    setPost(value);
    setPhase('outro');
    await save({
      status: 'completed',
      endedAt: new Date().toISOString(),
      pre: pre === undefined ? {} : { [module.preMeasure.id]: pre },
      post: value === undefined ? {} : { [module.postMeasure.id]: value },
      answers,
    });
  };

  const goTo = (moduleId: string, nextVariant: VariantKey) =>
    navigate(`/m/${moduleId}/${nextVariant}`, {
      replace: true,
      state: { entry: 'next', fromSessionId: sessionId.current ?? undefined, checkinId: context.checkinId } satisfies PlayerContext,
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
          <ScaleButtons label={module.preMeasure.label} value={pre} onChange={setPre} />
        </div>
        <div className="stack">
          <button type="button" className="btn btn-primary btn-block" onClick={() => begin(false)} disabled={pre === undefined}>
            시작하기
          </button>
          <button type="button" className="btn-link" onClick={() => begin(true)}>
            점수 없이 바로 시작
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'post') {
    return (
      <div className="player">
        <div className="player-body input">
          <ScaleButtons label={module.postMeasure.label} value={post} onChange={setPost} />
          {pre !== undefined && <p className="muted">시작할 때: {pre}점</p>}
        </div>
        <div className="stack">
          <button type="button" className="btn btn-primary btn-block" disabled={post === undefined} onClick={() => void finishPost(post)}>
            다음
          </button>
          <button type="button" className="btn-link" onClick={() => void finishPost(undefined)}>
            건너뛰기
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'outro') {
    const nextScope = { ...scope, post: post === undefined ? {} : { [module.postMeasure.id]: post } };
    const suggestions = module.outro.next
      .filter((n) => n.module && n.module !== module.id && getModule(n.module) && evaluate(n.if, nextScope))
      .slice(0, 2);
    const reflection = module.outro.reflection;
    return (
      <div className="player">
        <div className="player-body input">
          <p className="say" style={{ textAlign: 'left', margin: '0 0 24px' }}>{module.outro.message}</p>
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
  const isInput = step.type === 'scale' || step.type === 'choice' || step.type === 'text';
  const optional = 'optional' in step && step.optional;
  const answered = answers[step.id] !== undefined && answers[step.id] !== '' && !(Array.isArray(answers[step.id]) && (answers[step.id] as unknown[]).length === 0);
  const vars = { ...answers, before: pre };

  return (
    <div className="player">
      {header}
      <div className={`player-body${isInput ? ' input' : ''}`} key={`${index}-${stepStartedAt}`}>
        {step.type === 'say' && <SayView text={step.text} emphasis={step.emphasis} vars={vars} />}
        {step.type === 'pacer' && <PacerView step={step} startedAt={stepStartedAt} />}
        {step.type === 'timer' && <TimerView step={step} startedAt={stepStartedAt} />}
        {isInput && <InputView step={step} value={answers[step.id]} onChange={(val) => setAnswers((a) => ({ ...a, [step.id]: val }))} />}
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
        {isInput ? (
          <button type="button" className="btn btn-primary" disabled={!answered && !optional} onClick={() => advanceFrom(index, Date.now())}>
            {answered || !optional ? '다음' : '건너뛰기'}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => advanceFrom(index, Date.now())} aria-label="다음 단계로">
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
            <div key={t.problem} className="card" style={{ marginBottom: 0 }}>
              <button type="button" className="choice" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} style={{ width: '100%' }}>
                {t.problem}
              </button>
              {open === i && (
                <div style={{ marginTop: 12 }}>
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
