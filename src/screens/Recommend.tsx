import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getModule } from '../content/load';
import { getRecommendation, updateRecommendation } from '../db/repo';
import type { RecPick, RecommendationRecord } from '../domain/types';
import type { PlayerContext } from '../player/ModulePlayer';

export function Recommend() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rec, setRec] = useState<RecommendationRecord | null | undefined>();

  useEffect(() => {
    if (id) getRecommendation(id).then((r) => setRec(r ?? null), () => setRec(null));
  }, [id]);

  if (rec === undefined) return null;
  if (rec === null) {
    return (
      <div>
        <p>추천을 찾지 못했어요.</p>
        <Link className="btn" to="/">홈으로</Link>
      </div>
    );
  }

  const start = async (pick: RecPick, chosen: 'primary' | 'alt1' | 'alt2') => {
    await updateRecommendation(rec.id, { chosen }).catch(() => {});
    navigate(`/m/${pick.module}/${pick.variant}`, {
      replace: true,
      state: { entry: 'recommendation', checkinId: rec.checkinId, recommendationId: rec.id, state: rec.state } satisfies PlayerContext,
    });
  };

  const decline = async () => {
    await updateRecommendation(rec.id, { chosen: 'declined' }).catch(() => {});
    navigate('/', { replace: true });
  };

  const primary = getModule(rec.primary.module);

  return (
    <div>
      <h1>이걸 해볼 수 있어요</h1>
      {rec.banner && (
        <div className="card banner">
          <p>{rec.banner}</p>
        </div>
      )}
      {primary && (
        <div className="card">
          <p style={{ fontSize: '1.2em', fontWeight: 700, marginBottom: 4 }}>{primary.name}</p>
          <p className="muted">{primary.variants[rec.primary.variant]?.durationLabel}</p>
          <p>{rec.primary.reason}</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => void start(rec.primary, 'primary')}>
            시작하기
          </button>
        </div>
      )}
      <h2>다른 방법</h2>
      <div className="stack">
        {rec.alternatives.map((alt, i) => {
          const m = getModule(alt.module);
          if (!m) return null;
          return (
            <button key={alt.module} type="button" className="choice" onClick={() => void start(alt, i === 0 ? 'alt1' : 'alt2')}>
              {m.name} · {m.variants[alt.variant]?.durationLabel}
              <small>{alt.reason}</small>
            </button>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 24, justifyContent: 'space-between' }}>
        <Link className="btn" to="/modules" onClick={() => void updateRecommendation(rec.id, { chosen: 'other' }).catch(() => {})}>
          직접 고르기
        </Link>
        <button type="button" className="btn-link" onClick={() => void decline()}>
          오늘은 그냥 두기
        </button>
      </div>
    </div>
  );
}
