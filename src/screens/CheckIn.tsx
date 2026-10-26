import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { catalog } from '../content/load';
import { addCheckin, addRecommendation, getSettings, recentHistory } from '../db/repo';
import { recommend } from '../domain/recommend';
import type { StateId, ThoughtKind } from '../domain/types';
import { useCrisisEmphasis } from '../safety/CrisisButton';
import { emphasizeCrisis } from '../safety/evaluate';
import { ChoiceList, ScaleButtons } from '../ui/inputs';

// 1단계 2장 판별 질문
const STATES: { value: StateId; label: string; hint: string }[] = [
  { value: 'A', label: '몸이 떨리고 숨이 가쁘고 심장이 빨리 뛴다', hint: '급성 불안' },
  { value: 'B', label: '같은 걱정이 머릿속에서 계속 돈다', hint: '걱정 루프' },
  { value: 'C', label: '피하고 싶은 일이 있다 / 해야 할 일 앞에서 얼어붙었다', hint: '회피 직전' },
  { value: 'D', label: '감정이 너무 커서 무엇이든 해버릴 것 같다', hint: '감정 폭주' },
  { value: 'E', label: '기운이 없고 아무것도 하기 싫다', hint: '무기력' },
  { value: 'F', label: '비교적 괜찮다', hint: '안정' },
];

const TIMES = [
  { value: '60', label: '1분' },
  { value: '180', label: '3분' },
  { value: '300', label: '5분 이상' },
];

export function CheckIn() {
  const navigate = useNavigate();
  const { setEmphasis } = useCrisisEmphasis();
  const [anxiety, setAnxiety] = useState<number>();
  const [mood, setMood] = useState<number>();
  const [energy, setEnergy] = useState<number>();
  const [states, setStates] = useState<string[]>([]);
  const [thoughtKind, setThoughtKind] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>(['180']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setEmphasis(emphasizeCrisis(mood));
    return () => setEmphasis(false);
  }, [mood, setEmphasis]);

  const ready = anxiety !== undefined && mood !== undefined && energy !== undefined && states.length > 0;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const now = new Date();
      const checkin = await addCheckin({
        anxiety,
        mood,
        energy,
        states: states as StateId[],
        available: Number(available[0] ?? 180) as 60 | 180 | 300,
        thoughtKind: states.includes('B') ? (thoughtKind[0] as ThoughtKind | undefined) : undefined,
        source: 'manual',
      });
      const [settings, history] = await Promise.all([getSettings(), recentHistory(now)]);
      const r = recommend({ checkin, settings, now, catalog: catalog(), history });
      const rec = await addRecommendation({ checkinId: checkin.id, state: r.state, primary: r.primary, alternatives: r.alternatives, banner: r.banner }, now);
      navigate(`/recommend/${rec.id}`, { replace: true });
    } catch (e) {
      console.error(e);
      setError(true);
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>지금 어때요?</h1>
      <ScaleButtons label="불안·긴장" value={anxiety} onChange={setAnxiety} />
      <ScaleButtons label="기분" value={mood} onChange={setMood} />
      {emphasizeCrisis(mood) && (
        <div className="card notice" role="status">
          <p>많이 힘든 상태인 것 같아요. 지금 도움이 필요하면 오른쪽 위 버튼을 눌러 주세요.</p>
        </div>
      )}
      <ScaleButtons label="에너지" value={energy} onChange={setEnergy} />
      <ChoiceList label="지금 가장 가까운 것은? (여러 개 골라도 돼요)" options={STATES} value={states} onChange={setStates} multi />
      {states.includes('B') && (
        <ChoiceList
          label="이 걱정은 어떤 쪽인가요?"
          options={[
            { value: 'prediction', label: '확인해 볼 수 있는 구체적인 예측', hint: '예: 발표 때 말을 더듬으면 다들 비웃을 거야' },
            { value: 'whatIf', label: "답이 없는 '만약에'", hint: '예: 혹시 나쁜 일이 생기면 어떡하지' },
          ]}
          value={thoughtKind}
          onChange={setThoughtKind}
        />
      )}
      <ChoiceList label="지금 쓸 수 있는 시간은?" options={TIMES} value={available} onChange={setAvailable} />
      {error && <p className="muted">저장하지 못했어요. 홈의 "바로 시작"으로 연습은 바로 할 수 있어요.</p>}
      <button type="button" className="btn btn-primary btn-block" disabled={!ready || busy} onClick={() => void submit()}>
        추천 받기
      </button>
    </div>
  );
}
