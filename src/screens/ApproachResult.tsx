// 예정된 다가가기의 결과 기록 (DB03 기본 버전 7번). 기록한 날이 "다가간 날"이 된다.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { completeApproachAttempt, getApproachAttempt, getApproachTask } from '../db/repo';
import type { ApproachAttempt } from '../domain/types';
import { ChoiceList, ScaleButtons, TextInput } from '../ui/inputs';

export function ApproachResult() {
  const { id = '' } = useParams();
  const [attempt, setAttempt] = useState<ApproachAttempt | null | undefined>();
  const [title, setTitle] = useState('');
  const [outcome, setOutcome] = useState('');
  const [cameTrue, setCameTrue] = useState<string[]>([]);
  const [peak, setPeak] = useState<number>();
  const [learned, setLearned] = useState('');
  const [done, setDone] = useState<'done' | 'skipped' | null>(null);

  useEffect(() => {
    (async () => {
      const a = await getApproachAttempt(id);
      setAttempt(a ?? null);
      if (a) setTitle((await getApproachTask(a.approachTaskId))?.title ?? '');
    })().catch(() => setAttempt(null));
  }, [id]);

  if (attempt === undefined) return null;
  if (attempt === null) {
    return (
      <div>
        <p>이 기록을 찾지 못했어요.</p>
        <Link className="btn" to="/">홈으로</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        {done === 'done' ? (
          <>
            <h1>한 걸음 다가갔어요.</h1>
            <p>불안이 높았어도, 그 상태로 해냈다는 게 가장 중요한 기록이에요.</p>
            {cameTrue[0] === 'worse' && (
              <p>
                생각보다 힘들었네요. 그래도 그 상황을 지나왔어요. 다음엔 사다리에서 한 칸 더 쉬운 단계로 해보거나, 안전행동은 그대로 두고 해봐도
                괜찮아요. 무엇이 힘들었는지는 저녁 기록에 남겨 두세요.
              </p>
            )}
          </>
        ) : (
          <>
            <h1>괜찮아요.</h1>
            <p>다음엔 더 작게 나눠서 해볼 수 있어요.</p>
          </>
        )}
        <Link className="btn btn-primary btn-block" to="/" replace>
          홈으로
        </Link>
      </div>
    );
  }

  const save = async (status: 'done' | 'skipped') => {
    await completeApproachAttempt(
      attempt.id,
      status === 'done'
        ? {
            status,
            outcome: outcome.trim() || undefined,
            predictionCameTrue: cameTrue[0] as ApproachAttempt['predictionCameTrue'],
            peakAnxiety: peak,
            learned: learned.trim() || undefined,
          }
        : { status },
    );
    setDone(status);
  };

  return (
    <div>
      <h1>다가가기 결과</h1>
      <div className="card">
        <p className="muted" style={{ marginBottom: 4 }}>{title}</p>
        <p style={{ fontWeight: 700 }}>{attempt.action}</p>
        {attempt.prediction && <p className="muted">예상했던 것: {attempt.prediction}</p>}
      </div>
      <TextInput
        label="실제로 어떤 일이 일어났나요?"
        value={outcome}
        onChange={setOutcome}
        example="목소리가 조금 떨렸지만, 옆자리 동료가 고개를 끄덕였다. 이상하게 쳐다보는 사람은 없었다."
      />
      <ChoiceList
        label="예상한 일이 일어났나요?"
        options={[
          { value: 'none', label: '전혀' },
          { value: 'partly', label: '일부' },
          { value: 'fully', label: '그대로' },
          { value: 'worse', label: '예상보다 더 나빴음' },
        ]}
        value={cameTrue}
        onChange={setCameTrue}
      />
      <ScaleButtons label="실행 중 가장 높았던 불안" value={peak} onChange={setPeak} />
      <TextInput
        label="이 경험에서 새로 알게 된 것은 무엇인가요? (선택)"
        value={learned}
        onChange={setLearned}
        example="떨려도 말은 할 수 있다. 사람들은 내 떨림을 생각만큼 신경 쓰지 않는다."
      />
      <div className="stack">
        <button type="button" className="btn btn-primary btn-block" disabled={!cameTrue.length} onClick={() => void save('done')}>
          기록하기
        </button>
        <button type="button" className="btn-link" onClick={() => void save('skipped')}>
          이번엔 못 했어요
        </button>
      </div>
    </div>
  );
}
