import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { catalog, getModule } from '../content/load';
import { getMeta, getSettings, plannedApproachAttempts, recentHistory, setMeta, todayActivity } from '../db/repo';
import { localDate } from '../domain/day';
import { quickStartPicks } from '../domain/recommend';
import { DEFAULT_SETTINGS, type ApproachAttempt } from '../domain/types';
import { evaluateSafety } from '../safety/evaluate';
import type { PlayerContext } from '../player/ModulePlayer';

const DEFAULT_QUICK = ['BR01', 'GR01', 'DB02'];

export function Home() {
  const navigate = useNavigate();
  const [quick, setQuick] = useState<string[]>(DEFAULT_QUICK.filter((id) => getModule(id)));
  const [doneToday, setDoneToday] = useState(0);
  const [approached, setApproached] = useState<string[]>([]);
  const [planned, setPlanned] = useState<ApproachAttempt[]>([]);
  const [lowMood, setLowMood] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const settings = await getSettings();
        const h = await recentHistory(now);
        const today = localDate(now, settings.dayBoundaryHour);
        setQuick(quickStartPicks({ settings, sessions: h.sessions, now, catalog: catalog() }));
        setDoneToday(h.sessions.filter((s) => s.localDate === today && s.status === 'completed').length);
        setApproached((await todayActivity(now)).approached.map((a) => a.action));
        setPlanned(await plannedApproachAttempts());
        const notice = evaluateSafety({
          now,
          journals: h.journals,
          checkins: h.checkins,
          boundaryHour: settings.dayBoundaryHour,
          lowMoodShownOn: await getMeta<string>('lowMoodShownOn'),
        });
        if (notice) {
          setLowMood(true);
          await setMeta('lowMoodShownOn', today);
        }
      } catch (e) {
        // 기록을 못 읽어도 바로 시작과 위기 안내는 쓸 수 있어야 한다
        console.error(e);
        setLoadError(true);
        setQuick(quickStartPicks({ settings: DEFAULT_SETTINGS, sessions: [], now: new Date(), catalog: catalog() }));
      }
    })();
  }, []);

  const start = (id: string) =>
    navigate(`/m/${id}/minimal`, { state: { entry: 'quickStart' } satisfies PlayerContext });

  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div>
      <p className="muted" style={{ marginTop: 8 }}>{today}</p>

      {lowMood && (
        <div className="card notice" role="status">
          <p><strong>요즘 많이 힘드셨던 것 같아요.</strong></p>
          <p>기분이 며칠째 많이 가라앉아 있어요. 혼자 견디지 않아도 괜찮아요. 이야기할 사람이 필요하면 언제든 연락할 수 있어요.</p>
          <div className="row">
            <Link className="btn" to="/crisis">연락처 보기</Link>
            <button type="button" className="btn-link" onClick={() => setLowMood(false)}>닫기</button>
          </div>
        </div>
      )}

      <Link to="/checkin" className="btn btn-primary btn-big" style={{ margin: '8px 0 24px' }}>
        지금 어때요?
      </Link>

      <h2>바로 시작</h2>
      <div className="quick">
        {quick.map((id) => {
          const m = getModule(id);
          if (!m) return null;
          return (
            <button key={id} type="button" className="btn" onClick={() => start(id)}>
              {m.name}
              <small>{m.variants.minimal.durationLabel}</small>
            </button>
          );
        })}
      </div>

      <Link to="/worry" className="btn btn-block" style={{ marginTop: 12 }}>
        + 걱정 메모
      </Link>

      {planned.length > 0 && (
        <>
          <h2>예정된 다가가기</h2>
          {planned.map((a) => (
            <div key={a.id} className="card">
              <p style={{ marginBottom: 4 }}>{a.action}</p>
              {a.scheduledFor && <p className="muted">{a.scheduledFor}</p>}
              <Link className="btn" to={`/approach/${a.id}`}>
                결과 기록하기
              </Link>
            </div>
          ))}
        </>
      )}

      <h2>오늘</h2>
      <div className="card">
        {loadError ? (
          <p className="muted">기록을 불러오지 못했어요. 연습과 위기 안내는 그대로 쓸 수 있어요.</p>
        ) : doneToday > 0 || approached.length > 0 ? (
          <>
            {doneToday > 0 && <p>오늘 연습 {doneToday}번. 잘하고 있어요.</p>}
            {approached.length > 0 && (
              <p>
                <strong>다가간 일:</strong> {approached.join(', ')}
              </p>
            )}
          </>
        ) : (
          <p className="muted">오늘은 아직 연습 기록이 없어요. 1분짜리부터 해볼 수 있어요.</p>
        )}
      </div>

      <p className="muted" style={{ marginTop: 32 }}>
        이 앱은 불안을 다루는 기술을 연습하는 보조 도구이며, 진단이나 전문 치료를 대신하지 않아요.
      </p>
    </div>
  );
}
