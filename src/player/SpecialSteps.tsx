// 콘텐츠만으로 표현할 수 없는 전용 단계 (설계 1.3의 list 등). 각각 답을 answers에 남긴다.
import { useEffect, useState } from 'react';
import { AFFIRMATIONS, getModule } from '../content/load';
import { addWorryNote, latestValue, listThoughts, listWorryNotes, today, todayActivity, updateSettings, updateWorryNote } from '../db/repo';
import { WEAKER_BELOW, pickAffirmation } from '../domain/affirmations';
import { localDate, timeOfDay } from '../domain/day';
import type { Settings, StateId, Thought, WorryNote } from '../domain/types';
import { ChoiceList, ScaleButtons, TextInput } from '../ui/inputs';

type SetAnswer = (value: unknown) => void;

/** CB03 Part 1: 걱정 한 줄을 적어 두고 하던 일로 돌아간다. */
export function WorryMemoView({ label, example, value, onChange }: { label: string; example?: string; value: unknown; onChange: SetAnswer }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  if (value) return <p className="say">적어 뒀어요.</p>;
  return (
    <div>
      <TextInput label={label} value={text} onChange={setText} example={example} />
      {error && <p className="muted">저장하지 못했어요. 다시 눌러 주세요.</p>}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!text.trim()}
        onClick={async () => {
          try {
            const note = await addWorryNote(text.trim());
            onChange(note.id);
          } catch {
            setError(true);
          }
        }}
      >
        걱정 메모 저장
      </button>
    </div>
  );
}

/** CB03 Part 2: 오늘의 걱정 메모를 다시 보고 분류한다. */
export function WorryReviewView({ onChange }: { onChange: SetAnswer }) {
  const [notes, setNotes] = useState<WorryNote[] | null>(null);
  useEffect(() => {
    (async () => setNotes(await listWorryNotes(await today())))().catch(() => setNotes([]));
  }, []);
  useEffect(() => {
    if (notes) onChange({ total: notes.length, stillImportant: notes.filter((n) => n.stillImportant).length });
    // onChange는 렌더마다 새로 만들어지므로 notes가 바뀔 때만 알린다
  }, [notes]);

  if (notes === null) return null;
  if (!notes.length) return <p className="say">오늘 적어 둔 걱정이 없어요. 걱정 시간을 건너뛰어도 괜찮아요.</p>;

  const patch = (id: string, p: Partial<WorryNote>) => {
    setNotes((ns) => ns!.map((n) => (n.id === id ? { ...n, ...p } : n)));
    void updateWorryNote(id, { ...p, reviewedAt: new Date().toISOString() }).catch(() => {});
  };

  return (
    <div>
      <p style={{ fontWeight: 600 }}>오늘 적어 둔 걱정이에요. 적을 때만큼 중요하게 느껴지는 걱정에만 표시해 보세요.</p>
      {notes.map((n) => (
        <div key={n.id} className="card">
          <p>{n.text}</p>
          <ChoiceList
            label="지금 읽어 보니"
            options={[
              { value: 'yes', label: '아직 중요해요' },
              { value: 'no', label: '지금은 괜찮아요' },
            ]}
            value={n.stillImportant === undefined ? [] : [n.stillImportant ? 'yes' : 'no']}
            onChange={(v) => patch(n.id, { stillImportant: v[0] === 'yes' })}
          />
          {n.stillImportant && (
            <ChoiceList
              label="내가 지금 무언가 할 수 있는 일인가요?"
              options={[
                { value: 'yes', label: '할 수 있는 일이 있다' },
                { value: 'no', label: '어쩔 수 없다' },
                { value: 'unsure', label: '잘 모르겠다' },
              ]}
              value={n.controllable ? [n.controllable] : []}
              onChange={(v) => patch(n.id, { controllable: v[0] as WorryNote['controllable'] })}
            />
          )}
          {n.stillImportant && n.controllable === 'yes' && (
            <TextInput
              label="할 수 있는 가장 작은 다음 행동 하나와 언제 할지 적어 보세요."
              value={n.nextAction ?? ''}
              onChange={(v) => patch(n.id, { nextAction: v })}
              example="내일 오전에 지난달 평가 기준표를 다시 읽어 본다."
            />
          )}
          {n.stillImportant && (n.controllable === 'no' || n.controllable === 'unsure') && (
            <p className="muted">이 걱정은 지금 내가 답을 낼 수 없는 일이에요. 오늘은 여기까지 생각한 걸로 충분해요.</p>
          )}
        </div>
      ))}
      <p className="muted">
        적을 땐 크게 느껴졌는데, 지금은 덜 중요하게 느껴지는 걱정이 있나요? 많은 걱정은 시간이 지나면 저절로 작아져요.
      </p>
    </div>
  );
}

/** AF01: 상태에 맞는 확언 하나. 믿는 정도가 3점 미만이면 더 약한 버전을 보여준다. */
export function AffirmationView({ state, settings, value, onChange }: { state?: StateId; settings: Settings | null; value: unknown; onChange: SetAnswer }) {
  // 저장된 내 가치가 있으면 가치형 확언의 {가치} 자리에 넣는다
  const [myValue, setMyValue] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    latestValue().then((v) => setMyValue(v?.label ?? null), () => setMyValue(null));
  }, []);
  if (myValue === undefined) return null;
  const now = new Date();
  const picked = pickAffirmation(AFFIRMATIONS, {
    state,
    time: timeOfDay(now),
    day: localDate(now, settings?.dayBoundaryHour ?? 4),
    have: myValue ? ['value'] : [],
  });
  const fill = (t: string) => (myValue ? t.replace('{가치}을/를', `'${myValue}'을/를`).replace('{가치}', myValue) : t);
  const v = (value ?? {}) as { affirmationBelief?: number; usedWeaker?: boolean; weakerBelief?: number };
  if (!picked) return <p className="say">오늘은 확언 없이 넘어가도 괜찮아요.</p>;
  const showWeaker = v.affirmationBelief !== undefined && v.affirmationBelief < WEAKER_BELOW;
  const noneFit = showWeaker && v.weakerBelief !== undefined && v.weakerBelief < WEAKER_BELOW;
  return (
    <div>
      <p>이 문장을 천천히, 소리 내거나 마음속으로 한 번 읽어 보세요.</p>
      <p className="say" style={{ fontWeight: 700, margin: '16px 0 24px', textAlign: 'center' }}>“{fill(picked.text)}”</p>
      <ScaleButtons
        label="이 말이 얼마나 믿어지나요?"
        value={v.affirmationBelief}
        onChange={(b) => onChange({ affirmationId: picked.id, affirmationBelief: b, usedWeaker: b < WEAKER_BELOW })}
      />
      {showWeaker && (
        <>
          <p>조금 더 작은 말로 바꿔 볼게요.</p>
          <p className="say" style={{ fontWeight: 700, margin: '16px 0 24px', textAlign: 'center' }}>“{fill(picked.weaker)}”</p>
          <ScaleButtons label="이 말은 얼마나 믿어지나요?" value={v.weakerBelief} onChange={(b) => onChange({ ...v, affirmationId: picked.id, weakerBelief: b })} />
        </>
      )}
      {noneFit && <p>오늘은 이 문장들이 와닿지 않는 날이네요. 그것도 괜찮아요.</p>}
    </div>
  );
}

/** CB02: 이전에 기록한 생각과 같은지 (MVP는 글 유사도 대신 사용자가 고른다, 설계 2.3). */
export function ThoughtSelectView({ value, onChange }: { value: unknown; onChange: (id: string, text?: string) => void }) {
  const [thoughts, setThoughts] = useState<Thought[] | null>(null);
  useEffect(() => {
    listThoughts().then(setThoughts, () => setThoughts([]));
  }, []);
  if (!thoughts) return null;
  return (
    <ChoiceList
      label="이전에 기록한 생각과 같은 생각인가요?"
      options={[
        ...thoughts.map((t) => ({
          value: t.id,
          label: t.text,
          hint: t.recordCount > 0 ? `사고기록지로 ${t.recordCount}번 기록함` : t.storyTitle,
        })),
        { value: 'new', label: '새로운 생각이에요' },
      ]}
      value={typeof value === 'string' ? [value] : []}
      onChange={(v) => {
        const t = thoughts.find((x) => x.id === v[0]);
        onChange(v[0], t?.text);
      }}
    />
  );
}

const TIPP_CONDITIONS = [
  { value: 'heart', label: '심장 질환이 있거나, 심장 관련 약(예: 베타 차단제)을 먹고 있다' },
  { value: 'pulse', label: '평소 맥박이 느리거나, 어지럼증·실신을 겪은 적이 있다' },
  { value: 'eating', label: '섭식 문제(거식, 폭식·구토)가 있거나 있었다' },
  { value: 'exercise', label: '운동을 제한하라는 의사의 권고를 받았다' },
  { value: 'cold', label: '추위에 알레르기가 있거나 레이노 현상이 있다' },
  { value: 'none', label: '해당하는 것이 없다' },
];

/** DB01: 처음 사용할 때 한 번 하는 안전 확인 (2단계 DB01). 결과는 설정에 저장한다. */
export function TippScreeningView({ onChange, onSettings }: { onChange: SetAnswer; onSettings: (s: Settings) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [saved, setSaved] = useState<boolean | null>(null);
  if (saved !== null) {
    return saved ? (
      <p className="say">찬물과 강한 움직임은 빼고, 호흡과 근육 이완만 안내할게요. 찬물과 운동을 쓰고 싶다면 먼저 의사와 상의해 주세요.</p>
    ) : (
      <p className="say">확인했어요. 이제 TIPP를 시작할게요.</p>
    );
  }
  return (
    <div>
      <p>TIPP의 찬물·강한 움직임은 몸에 순간적으로 큰 변화를 줘요. 아래에 해당하는 것이 있나요? (처음 한 번만 물어봐요)</p>
      <ChoiceList
        label="해당하는 것을 모두 골라 주세요"
        options={TIPP_CONDITIONS}
        value={picked}
        multi
        onChange={(v) => setPicked(v.includes('none') && !picked.includes('none') ? ['none'] : v.filter((x) => x !== 'none'))}
      />
      <p className="muted">이 목록은 DBT 매뉴얼의 주의사항을 바탕으로 했으며, 의학적 판단을 대신하지 않아요. 설정에서 나중에 바꿀 수 있어요.</p>
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!picked.length}
        onClick={async () => {
          const restricted = !picked.includes('none');
          const s = await updateSettings({ tippScreening: { done: true, restricted, answeredAt: new Date().toISOString() } });
          onSettings(s);
          onChange({ restricted });
          setSaved(restricted);
        }}
      >
        확인
      </button>
    </div>
  );
}

/** JR01: 오늘 앱에서 한 것 (자동 표시). DB03에서 다가간 일은 자동으로 들어간다 (1단계 5장). */
export function TodaySummaryView({ onChange }: { onChange: SetAnswer }) {
  const [summary, setSummary] = useState<{ names: string[]; worries: number; approached: string[] } | null>(null);
  useEffect(() => {
    todayActivity()
      .then((a) => {
        const ids = a.sessions.map((s) => s.moduleId).filter((id) => id !== 'JR01');
        const counts = new Map<string, number>();
        for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
        const names = [...counts].map(([id, n]) => `${getModule(id)?.name ?? id} ${n}회`);
        setSummary({ names, worries: a.worryNoteCount, approached: a.approached.map((x) => x.action) });
        onChange({ sessions: ids, worryNoteCount: a.worryNoteCount, approachAttemptIds: a.approached.map((x) => x.id) });
      })
      .catch(() => setSummary({ names: [], worries: 0, approached: [] }));
  }, []);
  if (!summary) return null;
  const empty = !summary.names.length && !summary.worries && !summary.approached.length;
  return (
    <div className="card">
      <p style={{ fontWeight: 600 }}>오늘 앱에서 한 것</p>
      {empty ? (
        <p className="muted">오늘은 앱에서 한 연습이 없어요. 그래도 괜찮아요.</p>
      ) : (
        <>
          {(summary.names.length > 0 || summary.worries > 0) && (
            <p>
              {summary.names.join(' · ')}
              {summary.worries > 0 && `${summary.names.length ? ' · ' : ''}걱정 메모 ${summary.worries}개`}
            </p>
          )}
          {summary.approached.length > 0 && (
            <p>
              <strong>다가간 일:</strong> {summary.approached.join(', ')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
