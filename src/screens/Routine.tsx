// 아침·저녁 루틴 (설계 7.2). 순서는 src/domain/routines.ts가 정한다.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getModule } from '../content/load';
import { addCheckin, getSettings, getTodayTask, listWorryNotes, setTodayTask, setTomorrowTask, today, todayTaskSources, type TodayTask } from '../db/repo';
import { ROUTINE_TITLE, buildRoutine, eveningClosing, suggestTodayTasks, type RoutineName, type RoutineStep, type TaskSuggestion } from '../domain/routines';
import type { VariantKey } from '../domain/types';
import { ModulePlayer, type PlayerContext } from '../player/ModulePlayer';
import { useCrisisEmphasis } from '../safety/CrisisButton';
import { emphasizeCrisis } from '../safety/evaluate';
import { ChoiceList, ScaleButtons, TextInput } from '../ui/inputs';

const NAMES: RoutineName[] = ['morning', 'morningMin', 'evening', 'eveningMin'];

export function Routine() {
  const params = useParams();
  const navigate = useNavigate();
  const name = (NAMES.includes(params.name as RoutineName) ? params.name : 'morning') as RoutineName;
  const index = Number(params.index ?? 0) || 0;
  const [steps, setSteps] = useState<RoutineStep[] | null>(null);

  // 순서는 루틴을 시작할 때의 상태로 정한다 (중간에 걱정 메모 수가 바뀌어도 순서는 그대로)
  useEffect(() => {
    (async () => {
      const [settings, notes] = await Promise.all([getSettings(), today().then(listWorryNotes)]);
      setSteps(buildRoutine(name, { affirmationsEnabled: settings.affirmationsEnabled, worryNotesToday: notes.length }));
    })().catch(() => setSteps(buildRoutine(name, { affirmationsEnabled: true, worryNotesToday: 0 })));
  }, [name]);

  if (!steps) return null;
  const step = steps[Math.min(index, steps.length - 1)];
  const go = (i: number) => navigate(`/routine/${name}/${i}`, { replace: true });
  const next = () => go(index + 1);
  const isMorning = name.startsWith('morning');

  return (
    <div>
      {step.kind !== 'module' && (
        <p className="muted" style={{ marginTop: 8 }}>
          {ROUTINE_TITLE[name]} · {Math.min(index + 1, steps.length)}/{steps.length}
        </p>
      )}
      {step.kind === 'checkin' && <MorningCheckin onDone={next} />}
      {step.kind === 'module' && <RoutineModule key={index} id={step.module} variant={step.variant} onNext={next} />}
      {step.kind === 'todayTask' && <TodayTaskPicker onDone={next} />}
      {step.kind === 'end' && (isMorning ? <MorningEnd /> : <EveningEnd minimal={name === 'eveningMin'} />)}
    </div>
  );
}

function RoutineModule({ id, variant, onNext }: { id: string; variant: VariantKey; onNext: () => void }) {
  const module = getModule(id);
  useEffect(() => {
    if (!module) onNext();
  }, [module, onNext]);
  if (!module) return null;
  return <ModulePlayer module={module} variant={variant} context={{ entry: 'routine' } satisfies PlayerContext} routine={{ onNext, nextLabel: '다음' }} />;
}

/** 아침 체크인: 점수 3개만 (상태와 시간은 묻지 않는다). */
function MorningCheckin({ onDone }: { onDone: () => void }) {
  const { setEmphasis } = useCrisisEmphasis();
  const [anxiety, setAnxiety] = useState<number>();
  const [mood, setMood] = useState<number>();
  const [energy, setEnergy] = useState<number>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEmphasis(emphasizeCrisis(mood));
    return () => setEmphasis(false);
  }, [mood, setEmphasis]);

  return (
    <div>
      <h1>좋은 아침이에요. 지금 어때요?</h1>
      <ScaleButtons label="불안·긴장" value={anxiety} onChange={setAnxiety} />
      <ScaleButtons label="기분" value={mood} onChange={setMood} />
      {emphasizeCrisis(mood) && (
        <div className="card notice" role="status">
          <p>많이 힘든 상태인 것 같아요. 지금 도움이 필요하면 오른쪽 위 버튼을 눌러 주세요.</p>
        </div>
      )}
      <ScaleButtons label="에너지" value={energy} onChange={setEnergy} />
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={anxiety === undefined || mood === undefined || energy === undefined || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await addCheckin({ anxiety: anxiety!, mood: mood!, energy: energy!, states: [], available: 180, source: 'morning' });
          } catch (e) {
            console.error(e);
          }
          onDone();
        }}
      >
        다음
      </button>
    </div>
  );
}

/** 오늘 다가갈 작은 일 하나 (설계 7.2 아침 흐름). */
function TodayTaskPicker({ onDone }: { onDone: () => void }) {
  const [suggestions, setSuggestions] = useState<TaskSuggestion[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [own, setOwn] = useState('');

  useEffect(() => {
    todayTaskSources()
      .then((src) => setSuggestions(suggestTodayTasks(src)))
      .catch(() => setSuggestions([]));
  }, []);
  if (!suggestions) return null;

  const choice = suggestions.find((s) => s.text === picked[0]);
  const text = own.trim() || choice?.text;

  return (
    <div>
      <h1>오늘 다가갈 작은 일 하나</h1>
      <p>불안해서 미루던 일 중에, 오늘 해볼 수 있는 아주 작은 걸음 하나를 골라 보세요.</p>
      {suggestions.length > 0 && (
        <ChoiceList
          label="이런 걸 해볼 수 있어요"
          options={suggestions.map((s) => ({ value: s.text, label: s.text, hint: s.hint }))}
          value={picked}
          onChange={(v) => {
            setPicked(v);
            setOwn('');
          }}
        />
      )}
      <TextInput
        label={suggestions.length ? '또는 직접 적어 보세요' : '직접 적어 보세요'}
        value={own}
        onChange={(v) => {
          setOwn(v);
          if (v) setPicked([]);
        }}
        example="친구에게 먼저 연락하기"
      />
      <div className="stack">
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!text}
          onClick={async () => {
            await setTodayTask({ text: text!, source: own.trim() ? 'own' : choice!.source, approachTaskId: own.trim() ? undefined : choice?.approachTaskId }).catch(() => {});
            onDone();
          }}
        >
          이걸로 할게요
        </button>
        <button type="button" className="btn-link" onClick={onDone}>
          오늘은 건너뛰기
        </button>
      </div>
    </div>
  );
}

function MorningEnd() {
  const navigate = useNavigate();
  const [task, setTask] = useState<TodayTask | undefined>();
  useEffect(() => {
    getTodayTask().then(setTask, () => {});
  }, []);
  return (
    <div>
      <h1>아침 루틴을 마쳤어요.</h1>
      {task ? (
        <div className="card">
          <p className="muted" style={{ marginBottom: 4 }}>오늘 다가갈 일</p>
          <p style={{ fontWeight: 700 }}>{task.text}</p>
          <p className="muted">불안이 있어도 괜찮아요. 준비되면 아주 작은 첫걸음부터 해볼 수 있어요.</p>
          <button
            type="button"
            className="btn btn-block"
            onClick={() => navigate('/m/DB03/minimal', { replace: true, state: { entry: 'routine', carry: { task: task.text } } satisfies PlayerContext })}
          >
            지금 바로 해보기 (반대 행동 · 1분)
          </button>
        </div>
      ) : (
        <p>오늘 하루도 내 속도로 가요.</p>
      )}
      <Link className="btn btn-primary btn-block" to="/" replace>
        홈으로
      </Link>
    </div>
  );
}

function EveningEnd({ minimal }: { minimal: boolean }) {
  const navigate = useNavigate();
  const [closing, setClosing] = useState('');
  const [tomorrow, setTomorrow] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    today().then((d) => setClosing(eveningClosing(d)), () => setClosing(eveningClosing('')));
  }, []);
  return (
    <div>
      <h1>{closing}</h1>
      {!minimal && (
        <div className="card">
          {saved ? (
            <p>내일 아침에 "오늘 다가갈 작은 일"로 다시 보여 드릴게요.</p>
          ) : (
            <>
              <TextInput label="내일 다가가 볼 작은 일 하나 (선택)" value={tomorrow} onChange={setTomorrow} example="회의 전에 하고 싶은 말을 한 문장으로 적어 두기" />
              <button
                type="button"
                className="btn btn-block"
                disabled={!tomorrow.trim()}
                onClick={async () => {
                  await setTomorrowTask(tomorrow.trim()).catch(() => {});
                  setSaved(true);
                }}
              >
                내일로 남겨 두기
              </button>
            </>
          )}
        </div>
      )}
      <p className="muted">잠이 안 올 것 같다면 느린 호흡을 해볼 수 있어요.</p>
      <div className="stack">
        <button
          type="button"
          className="btn btn-block"
          onClick={() => navigate('/m/BR02/extended', { replace: true, state: { entry: 'routine' } satisfies PlayerContext })}
        >
          느린 호흡 · 5분
        </button>
        <Link className="btn btn-primary btn-block" to="/" replace>
          하루 마치기
        </Link>
      </div>
    </div>
  );
}
