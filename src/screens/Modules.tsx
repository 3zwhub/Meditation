import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ASSESSMENTS, MODULES, SEQUENCES, assessmentReady } from '../content/load';
import type { VariantKey } from '../domain/types';
import type { PlayerContext } from '../player/ModulePlayer';

const EVIDENCE: Record<string, string> = { strong: '근거 강함', moderate: '근거 중간', preliminary: '근거 예비', hypothesis: '가설' };
const VARIANTS: { key: VariantKey; label: string }[] = [
  { key: 'minimal', label: '최소' },
  { key: 'basic', label: '기본' },
  { key: 'extended', label: '확장' },
];

export function Modules() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>모든 연습</h1>
      <p className="muted">지금은 {MODULES.size}개 연습이 들어 있어요. 나머지는 차례로 추가돼요.</p>
      {[...MODULES.values()].map((m) => (
        <div key={m.id} className="card">
          <p style={{ fontWeight: 700, marginBottom: 4 }}>
            {m.name} <span className="tag">{EVIDENCE[m.evidence.level]}</span>
          </p>
          <p className="muted">{m.summary}</p>
          <details>
            <summary className="muted">근거에 대해</summary>
            <p className="muted">{m.evidence.note}</p>
          </details>
          <div className="row" style={{ marginTop: 8 }}>
            {VARIANTS.filter((v) => m.variants[v.key]).map((v) => (
              <button
                key={v.key}
                type="button"
                className="btn"
                onClick={() => navigate(`/m/${m.id}/${v.key}`, { state: { entry: 'search' } satisfies PlayerContext })}
              >
                {v.label} · {m.variants[v.key]!.durationLabel}
              </button>
            ))}
          </div>
        </div>
      ))}
      <h2>이어서 하는 순서</h2>
      <div className="stack">
        {SEQUENCES.map((q) => (
          <Link key={q.id} className="choice" to={`/sequence/${q.id}/0`}>
            {q.title} · {q.duration}
            <small>{q.why}</small>
          </Link>
        ))}
      </div>
      <h2>점수로 돌아보기</h2>
      <p className="muted">지난 2주를 돌아보는 짧은 검사예요. 진단이 아니라 참고 자료예요.</p>
      <div className="row">
        {[...ASSESSMENTS.values()].map((a) => (
          <Link key={a.id} className="btn" to={`/assess/${a.id.toLowerCase()}`}>
            {a.name}
            {!assessmentReady(a) && ' (준비 중)'}
          </Link>
        ))}
      </div>
    </div>
  );
}
