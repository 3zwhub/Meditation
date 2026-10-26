import { useEffect, useRef, useState } from 'react';
import type { Step } from '../content/schema';
import { ChoiceList, PercentInput, ScaleButtons, TextInput } from '../ui/inputs';
import { PHASE_LABEL, fillTemplate, pacerFrame } from './timeline';

type PacerStep = Extract<Step, { type: 'pacer' }>;
type TimerStep = Extract<Step, { type: 'timer' }>;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** requestAnimationFrame으로 매 프레임 시작 시각부터의 경과 초를 돌려준다. */
function useElapsed(startedAt: number) {
  const [elapsed, setElapsed] = useState(() => (Date.now() - startedAt) / 1000);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setElapsed((Date.now() - startedAt) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [startedAt]);
  return elapsed;
}

export function SayView({ text, emphasis, vars }: { text: string; emphasis?: boolean; vars: Record<string, unknown> }) {
  return (
    <p className={`say${emphasis ? ' emphasis' : ''}`} aria-live="polite">
      {fillTemplate(text, vars)}
    </p>
  );
}

export function PacerView({ step, startedAt }: { step: PacerStep; startedAt: number }) {
  const elapsed = useElapsed(startedAt);
  const reduced = usePrefersReducedMotion();
  const total = step.pattern.reduce((s, p) => s + p.sec, 0) * step.cycles;
  const frame = pacerFrame(step.pattern, Math.min(elapsed, total - 0.001));
  const cue = step.cycleCues?.[frame.cycle]?.[frame.phase];
  const timed = [...(step.cues ?? [])].reverse().find((c) => elapsed >= c.atSec && elapsed - c.atSec < 9);
  return (
    <div>
      {reduced ? (
        <div className="pacer-bar" aria-hidden="true">
          <div style={{ width: `${Math.round(((frame.size - 0.55) / 0.45) * 100)}%` }} />
        </div>
      ) : (
        <div className="pacer" aria-hidden="true">
          <div className="pacer-ring" />
          <div className="pacer-circle" style={{ transform: `scale(${frame.size})` }} />
        </div>
      )}
      <p className="pacer-label" aria-live="polite">
        {cue ?? PHASE_LABEL[frame.phase]}
        {reduced && ` · ${Math.ceil(frame.phaseRemaining)}초`}
      </p>
      <p className="pacer-cue">{timed?.text ?? ''}</p>
      <p className="muted">
        {Math.min(frame.cycle + 1, step.cycles)} / {step.cycles}
      </p>
    </div>
  );
}

export function TimerView({ step, startedAt }: { step: TimerStep; startedAt: number }) {
  const elapsed = useElapsed(startedAt);
  return (
    <div>
      <p className="say">{step.label}</p>
      <p className="countdown" aria-live="off">{Math.max(0, Math.ceil(step.sec - elapsed))}</p>
      <p className="muted">언제든 멈춰도 괜찮아요.</p>
    </div>
  );
}

export function InputView({
  step,
  value,
  onChange,
}: {
  step: Extract<Step, { type: 'scale' | 'choice' | 'text' }>;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (step.type === 'scale') {
    return step.max === 100 ? (
      <PercentInput label={step.label} value={value as number | undefined} onChange={onChange} />
    ) : (
      <ScaleButtons label={step.label} value={value as number | undefined} onChange={onChange} min={step.min} max={step.max} />
    );
  }
  if (step.type === 'choice') {
    const arr = Array.isArray(value) ? (value as string[]) : value ? [value as string] : [];
    return (
      <ChoiceList
        label={step.label}
        options={step.options ?? []}
        value={arr}
        multi={step.multi}
        onChange={(v) => onChange(step.multi ? (step.maxSelect ? v.slice(-step.maxSelect) : v) : v[0])}
      />
    );
  }
  return (
    <TextInput label={step.label} value={(value as string) ?? ''} onChange={onChange} placeholder={step.placeholder} example={step.example} />
  );
}

/** 모듈 진행 중 화면이 꺼지지 않게 한다. 지원하지 않는 브라우저에서는 조용히 넘어간다. */
export function useWakeLock(active: boolean) {
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    let cancelled = false;
    const request = () =>
      nav.wakeLock
        ?.request('screen')
        .then((l) => {
          if (cancelled) void l.release();
          else lock.current = l;
        })
        .catch(() => {});
    void request();
    const onVisible = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [active]);
}
