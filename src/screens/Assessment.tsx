// GAD-7·PHQ-9 (설계 4장, 5.2). PHQ-9 9번에 1점 이상이면 결과보다 안전 확인이 먼저다.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ASSESSMENTS, assessmentReady } from '../content/load';
import type { AssessmentContent } from '../content/schema';
import { addAssessment, listAssessments, logCrisisEvent } from '../db/repo';
import { scoreAssessment, type Band } from '../domain/assessments';
import type { Assessment as AssessmentRecord } from '../domain/types';
import { CRISIS_CONTACTS } from '../safety/contacts';
import { needsSafetyCheck } from '../safety/evaluate';

export function AssessmentRoute() {
  const { instrument = '' } = useParams();
  const content = ASSESSMENTS.get(instrument.toUpperCase());
  if (!content) {
    return (
      <div>
        <p>이 검사를 찾지 못했어요.</p>
        <Link className="btn" to="/">홈으로</Link>
      </div>
    );
  }
  return <AssessmentScreen key={content.id} content={content} />;
}

type Phase = 'intro' | 'items' | 'safety' | 'result';

export function AssessmentScreen({ content }: { content: AssessmentContent }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('intro');
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => Array(content.itemCount).fill(undefined));
  const [result, setResult] = useState<{ total: number; band: Band; item9?: number } | null>(null);
  const [previous, setPrevious] = useState<AssessmentRecord | undefined>();
  const [safeConfirmed, setSafeConfirmed] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    listAssessments(content.id).then((l) => setPrevious(l[0]), () => {});
  }, [content.id]);

  if (!assessmentReady(content)) {
    return (
      <div>
        <h1>{content.name}</h1>
        <p className="muted">{content.fullName}</p>
        <div className="card">
          <p><strong>문항 준비 중이에요.</strong></p>
          <p>
            이 검사는 공식 한국어판 문구를 그대로 써야 해서, 문구를 확보한 뒤에 열 수 있어요. 비슷하게 바꿔 쓴 문항으로는 점수를 믿을 수 없기
            때문이에요.
          </p>
        </div>
        <Link className="btn btn-block" to="/">홈으로</Link>
      </div>
    );
  }

  const items = content.items!;
  const options = content.options!;
  const max = content.itemCount * 3;

  const submit = async () => {
    const filled = answers as number[];
    const { total, band } = scoreAssessment(filled, content.bands);
    const item9 = content.safetyItem ? filled[content.safetyItem - 1] : undefined;
    setResult({ total, band, item9 });
    try {
      await addAssessment({ instrument: content.id, answers: filled, total, band: band.label, ...(item9 !== undefined ? { item9 } : {}) });
    } catch (e) {
      console.error(e);
      setSaveError(true);
    }
    // 설계 5.2: 9번 응답이 1점 이상이면 결과 화면 전에 안전 확인
    setPhase(needsSafetyCheck({ instrument: content.id, item9 }) ? 'safety' : 'result');
  };

  if (phase === 'intro') {
    return (
      <div>
        <h1>{content.name}</h1>
        <p className="muted">{content.fullName}</p>
        <p>{content.instruction}</p>
        <p className="muted">1~2분이면 돼요. 이 점수는 진단이 아니에요. 지난 2주를 돌아보는 참고 자료예요.</p>
        {previous && (
          <p className="muted">
            지난번: {previous.total}점 ({previous.localDate})
          </p>
        )}
        <button type="button" className="btn btn-primary btn-block" onClick={() => setPhase('items')}>
          시작하기
        </button>
        <p className="muted" style={{ marginTop: 16 }}>출처: {content.source!.title}</p>
      </div>
    );
  }

  if (phase === 'items') {
    const done = answers.every((a) => a !== undefined);
    return (
      <div>
        <p style={{ fontWeight: 600 }}>{content.instruction}</p>
        {items.map((q, i) => (
          <div key={q} className="card" role="group" aria-labelledby={`q${i}`}>
            <p id={`q${i}`}>
              {i + 1}. {q}
            </p>
            <div className="choices">
              {options.map((o, score) => (
                <button
                  key={o}
                  type="button"
                  className="choice"
                  aria-pressed={answers[i] === score}
                  onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? score : x)))}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-primary btn-block" disabled={!done} onClick={() => void submit()}>
          결과 보기
        </button>
      </div>
    );
  }

  if (phase === 'safety') {
    return (
      <div>
        <h1>지금 안전한가요?</h1>
        <p>죽음이나 스스로를 해치는 것에 대한 생각이 있었다고 답해 주셨어요. 말해 줘서 고마워요. 결과를 보기 전에 먼저 지금 상태를 확인하고 싶어요.</p>
        <div className="stack">
          <button
            type="button"
            className="btn btn-block"
            style={{ borderColor: 'var(--crisis)', color: 'var(--crisis)', fontWeight: 700 }}
            onClick={() => {
              void logCrisisEvent('phq9item9', new Date(), 'notSafe');
              navigate('/crisis', { replace: true });
            }}
          >
            안전하지 않아요 · 지금 도움이 필요해요
          </button>
          <button
            type="button"
            className="btn btn-block"
            onClick={() => {
              void logCrisisEvent('phq9item9', new Date(), 'safe');
              setSafeConfirmed(true);
              setPhase('result');
            }}
          >
            지금은 안전해요
          </button>
        </div>
      </div>
    );
  }

  // phase === 'result'
  const { total, band } = result!;
  return (
    <div>
      {safeConfirmed && (
        <div className="card notice" role="status">
          <p><strong>이런 생각이 들 때 연락할 수 있는 곳</strong></p>
          {CRISIS_CONTACTS.map((c) => (
            <a key={c.tel} className="crisis-call" href={`tel:${c.tel}`}>
              <strong>{c.number}</strong>
              <span>
                {c.label}
                {c.hours && ` · ${c.hours}`}
              </span>
            </a>
          ))}
        </div>
      )}
      <h1>
        {content.name} {total}점 <span className="muted">/ {max}</span>
      </h1>
      <p className="tag">{band.label}</p>
      <p style={{ marginTop: 12 }}>{band.message}</p>
      {previous && (
        <p className="muted">
          지난번({previous.localDate})에는 {previous.total}점이었어요.
        </p>
      )}
      {band.recommend !== 'none' && (
        <div className={`card${band.recommend === 'strong' ? ' notice' : ''}`}>
          <p><strong>전문가와 이야기해 볼 수 있는 곳</strong></p>
          <ul>
            <li>가까운 정신건강복지센터 (지역별 무료 상담)</li>
            <li>정신건강의학과 의원·병원</li>
            <li>정신건강위기상담 1577-0199 (24시간)</li>
          </ul>
          <p className="muted">이 앱은 그동안 연습을 이어가는 보조 도구로 함께 쓸 수 있어요.</p>
        </div>
      )}
      {saveError && <p className="muted">결과를 저장하지 못했어요.</p>}
      <p className="muted">이 점수는 진단이 아니에요. 지난 2주를 돌아보는 참고 자료예요.</p>
      <Link className="btn btn-primary btn-block" to="/" replace>
        홈으로
      </Link>
    </div>
  );
}
