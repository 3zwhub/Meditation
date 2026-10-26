// 처음 실행 (설계 7.1 온보딩). 순서: 이 앱은 무엇인가 → 위기 연락처 → 걱정 시간 → 시작
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ASSESSMENTS, assessmentReady } from '../content/load';
import { setMeta, updateSettings } from '../db/repo';
import { CRISIS_CONTACTS } from '../safety/contacts';

export const ONBOARDING_KEY = 'onboardingDone';
const STEPS = 4;

export function Welcome() {
  const navigate = useNavigate();
  const step = Math.min(Math.max(Number(useParams().step ?? 0) || 0, 0), STEPS - 1);
  const [worryTime, setWorryTime] = useState('21:30');
  const go = (i: number) => navigate(`/welcome/${i}`);

  const finish = async (to: string) => {
    try {
      await setMeta(ONBOARDING_KEY, new Date().toISOString());
    } catch (e) {
      console.error(e);
    }
    // 브라우저가 공간 부족 시 기록을 지우지 않도록 요청한다 (설계 6.2)
    await navigator.storage?.persist?.().catch(() => false);
    navigate(to, { replace: true });
  };

  const dots = (
    <div className="dots" style={{ justifyContent: 'flex-start', margin: '8px 0 16px', maxWidth: 'none' }} aria-label={`${STEPS}단계 중 ${step + 1}단계`}>
      {Array.from({ length: STEPS }, (_, i) => (
        <span key={i} className={i <= step ? 'on' : ''} />
      ))}
    </div>
  );

  if (step === 0) {
    return (
      <div>
        {dots}
        <h1>마음 연습에 오신 걸 환영해요</h1>
        <p>불안이 올라올 때 쓸 수 있는 기술을, 하루 10분 안에서 조금씩 연습하는 앱이에요. 호흡과 그라운딩, 생각과 거리 두기, 피하던 일에 한 걸음 다가가기 같은 연습이 들어 있어요.</p>
        <div className="card">
          <p><strong>이 앱이 아닌 것</strong></p>
          <p style={{ margin: 0 }}>진단이나 전문 치료를 대신하지 않아요. 연습을 돕는 보조 도구예요. 힘든 상태가 이어지면 전문가와 함께 쓰는 걸 권해요.</p>
        </div>
        <div className="card">
          <p><strong>기록은 이 기기 안에만</strong></p>
          <p style={{ margin: 0 }}>점수와 일기는 이 기기의 브라우저 안에만 저장되고, 어디로도 보내지 않아요. 브라우저 데이터를 지우면 함께 사라지니, 설정에서 가끔 백업해 두세요.</p>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={() => go(1)}>
          다음
        </button>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div>
        {dots}
        <h1>힘들 때 연락할 수 있는 곳</h1>
        <p>자해나 죽음에 대한 생각이 들거나, 혼자 견디기 어려울 때는 앱보다 사람에게 먼저 연락해 주세요. 24시간 열려 있어요.</p>
        {CRISIS_CONTACTS.map((c) => (
          <a key={c.tel} className="crisis-call" href={`tel:${c.tel}`}>
            <strong>{c.number}</strong>
            <span>
              {c.label}
              {c.hours && ` · ${c.hours}`}
            </span>
          </a>
        ))}
        <p className="muted">모든 화면 오른쪽 위의 <strong>"위기"</strong> 버튼을 누르면 언제든 이 연락처가 나와요. 인터넷이 없어도 열려요.</p>
        <button type="button" className="btn btn-primary btn-block" onClick={() => go(2)}>
          다음
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div>
        {dots}
        <h1>걱정 시간을 정해 볼까요?</h1>
        <p>
          낮에 걱정이 오면 한 줄로 적어 두고, 하루 한 번 정해 둔 시간에 모아서 다뤄요. 그러면 하루 종일 같은 걱정에 끌려다니지 않을 수 있어요.
          잠들기 최소 1시간 전으로 정해 보세요.
        </p>
        <label htmlFor="welcomeWorryTime" style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>
          걱정 시간
        </label>
        <input
          id="welcomeWorryTime"
          type="time"
          value={worryTime}
          onChange={(e) => setWorryTime(e.target.value)}
          style={{ minHeight: 48, fontSize: '1em', padding: '0 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: 16 }}
        />
        <div className="stack">
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={!worryTime}
            onClick={async () => {
              await updateSettings({ worryTime }).catch(() => {});
              go(3);
            }}
          >
            이 시간으로 할게요
          </button>
          <button type="button" className="btn-link" onClick={() => go(3)}>
            나중에 정할게요
          </button>
        </div>
      </div>
    );
  }

  const ready = [...ASSESSMENTS.values()].filter(assessmentReady);
  return (
    <div>
      {dots}
      <h1>준비됐어요</h1>
      <div className="card">
        <p><strong>이렇게 시작해 보세요</strong></p>
        <ul style={{ margin: 0 }}>
          <li>불안할 때: 홈의 <strong>"바로 시작"</strong>을 누르면 1분짜리 연습이 바로 시작돼요.</li>
          <li>어떤 연습이 맞을지 모를 때: <strong>"지금 어때요?"</strong>에 답하면 골라 드려요.</li>
          <li>하루 루틴: 아침 루틴과 저녁 기록. 힘든 날은 "최소로" 1분만 해도 충분해요.</li>
        </ul>
      </div>
      {ready.length > 0 ? (
        <div className="card">
          <p>시작하기 전에 지난 2주를 돌아보는 짧은 검사를 해볼 수 있어요. 1~2분이면 되고, 건너뛰어도 괜찮아요.</p>
          <button type="button" className="btn btn-block" onClick={() => void finish(`/assess/${ready[0].id.toLowerCase()}`)}>
            먼저 점검하기 ({ready.map((a) => a.name).join(', ')})
          </button>
        </div>
      ) : (
        <p className="muted">불안·우울 점검(GAD-7·PHQ-9)은 준비 중이에요. 준비되면 홈에서 알려 드릴게요.</p>
      )}
      <button type="button" className="btn btn-primary btn-block" onClick={() => void finish('/')}>
        시작하기
      </button>
    </div>
  );
}
