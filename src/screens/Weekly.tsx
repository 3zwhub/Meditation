// 주간 화면 (설계 4.3, 4.4). 연속 기록은 보여주지 않고, "이번 주 연습한 날"만 센다 (1단계 3장).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MODULES, getModule } from '../content/load';
import { today, weeklyData } from '../db/repo';
import { addDays } from '../domain/day';
import { adjustments, computeWeekly, weekStart, type Adjustment, type WeeklyMetrics } from '../domain/metrics';
import { WeekBars } from '../ui/WeekBars';

const fmt = (v: number | undefined) => (v === undefined ? '–' : v.toFixed(1));
const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;

const mainScale = new Map([...MODULES.values()].flatMap((m) => (m.postMeasure ? [[m.id, m.postMeasure.id] as const] : [])));
const kinds = new Map([...MODULES.values()].map((m) => [m.id, m.kind] as const));
const md02Reflection = getModule('MD02')?.outro.reflection;
const noteLabels = new Map<string, string>(
  (md02Reflection?.type === 'choice' ? (md02Reflection.options ?? []) : []).map((o) => [o.value, o.label]),
);

function weekLabel(start: string) {
  const f = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;
  return `${f(start)} ~ ${f(addDays(start, 6))}`;
}

export function Weekly() {
  const [start, setStart] = useState<string | null>(null);
  const [thisWeek, setThisWeek] = useState<string | null>(null);
  const [data, setData] = useState<{ m: WeeklyMetrics; adj: Adjustment[] } | null>(null);
  const [error, setError] = useState(false);

  // 이번 주(오늘이 속한 주)부터 시작한다
  useEffect(() => {
    today().then(
      (d) => {
        setThisWeek(weekStart(d));
        setStart(weekStart(d));
      },
      () => setError(true),
    );
  }, []);

  useEffect(() => {
    if (!start || !thisWeek) return;
    weeklyData(start)
      .then((d) => {
        const m = computeWeekly({ weekStart: start, ...d, mainScale, labels: { noteLabels } });
        // 조정 규칙은 지금 기준이라 이번 주 화면에서만 보여준다
        const adj = start === thisWeek ? adjustments({ today: d.today, sessions: d.sessions, attempts: d.attempts, gad7: d.gad7, kinds, firstUseDay: d.firstUseDay }) : [];
        setData({ m, adj });
      })
      .catch((e) => {
        console.error(e);
        setError(true);
      });
  }, [start, thisWeek]);

  if (error) return <p className="muted">기록을 불러오지 못했어요.</p>;
  if (!start || !data) return null;
  const { m, adj } = data;

  return (
    <div>
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 12px' }}>
        <button type="button" className="btn" aria-label="지난주" onClick={() => setStart(addDays(start, -7))}>
          ‹
        </button>
        <h1 style={{ margin: 0, fontSize: '1.1em' }}>{start === thisWeek ? '이번 주' : weekLabel(start)}</h1>
        <button type="button" className="btn" aria-label="다음 주" disabled={start === thisWeek} onClick={() => setStart(addDays(start, 7))}>
          ›
        </button>
      </div>
      {start === thisWeek && <p className="muted" style={{ textAlign: 'center', marginTop: -8 }}>{weekLabel(start)}</p>}

      {adj.map((a) => (
        <AdjustmentCard key={a.kind} a={a} />
      ))}

      {!m.hasData ? (
        <div className="card">
          <p>이 주에는 기록이 없어요.</p>
          <p className="muted">쉰 주도 괜찮아요. 오늘 1분짜리부터 다시 시작할 수 있어요.</p>
        </div>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <strong>{m.practiceDays}일</strong>
              <span>연습한 날</span>
            </div>
            <div className="stat">
              <strong>{m.approached.count}번</strong>
              <span>다가간 일</span>
            </div>
            <div className="stat">
              <strong>{m.avoidedDays}일</strong>
              <span>피한 날</span>
            </div>
          </div>

          <div className="card">
            <WeekBars title="하루 불안" values={m.anxiety} days={m.days} />
            <p className="muted" style={{ margin: 0 }}>
              평균 {fmt(m.anxietyAvg)}
              {m.prevAnxietyAvg !== undefined && ` · 지난주 ${fmt(m.prevAnxietyAvg)}`}
            </p>
          </div>
          <div className="card">
            <WeekBars title="하루 기분" values={m.mood} days={m.days} />
            <p className="muted" style={{ margin: 0 }}>평균 {fmt(m.moodAvg)}</p>
          </div>

          {m.approached.count > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600 }}>다가간 일</p>
              <ul style={{ margin: 0 }}>
                {m.approached.actions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {m.predictions.total > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600 }}>예상과 실제</p>
              <p style={{ margin: 0 }}>
                걱정했던 일이 그대로 일어난 건 {m.predictions.total}번 중 {m.predictions.fully + m.predictions.worse}번
                {m.predictions.worse > 0 && ` (예상보다 나빴던 건 ${m.predictions.worse}번)`}
              </p>
            </div>
          )}

          {m.effects.length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600 }}>연습별 변화 (시작 전 → 끝난 뒤)</p>
              {m.effects.slice(0, 4).map((e) => (
                <p key={e.moduleId} style={{ margin: '4px 0' }}>
                  {getModule(e.moduleId)?.name ?? e.moduleId} · {e.count}회 ·{' '}
                  {e.enough ? (e.mean >= 0 ? `평균 ${e.mean.toFixed(1)}점 내려감` : `평균 ${(-e.mean).toFixed(1)}점 올라감`) : <span className="muted">아직 적어요</span>}
                </p>
              ))}
              <p className="muted" style={{ margin: '8px 0 0' }}>
                당장 점수가 크게 바뀌지 않는 연습(다가가기, 작은 행동)도 있어요. 점수만으로 좋고 나쁨을 정하지 않아요.
              </p>
            </div>
          )}

          {m.activation.count > 0 && m.activation.pleasureGap !== undefined && (
            <div className="card">
              <p style={{ fontWeight: 600 }}>작은 행동: 예상 vs 실제</p>
              <p style={{ margin: 0 }}>
                즐거움은 예상보다 평균 {signed(m.activation.pleasureGap)}
                {m.activation.masteryGap !== undefined && `, 해냈다는 느낌은 ${signed(m.activation.masteryGap)}`}
              </p>
            </div>
          )}

          {m.worryTime.reviewed > 0 && (
            <div className="card">
              <p style={{ fontWeight: 600 }}>걱정 시간</p>
              <p style={{ margin: 0 }}>
                다시 본 걱정 {m.worryTime.reviewed}개 중 {m.worryTime.shrunk}개가 걱정 시간에 작아졌어요.
              </p>
            </div>
          )}

          {(m.frequent.noteLabel || m.frequent.story || m.frequent.bodyPart) && (
            <div className="card">
              <p style={{ fontWeight: 600 }}>자주 찾아온 것</p>
              {m.frequent.noteLabel && <p style={{ margin: '4px 0' }}>생각의 종류: {m.frequent.noteLabel}</p>}
              {m.frequent.story && <p style={{ margin: '4px 0' }}>마음이 들려준 이야기: {m.frequent.story}</p>}
              {m.frequent.bodyPart && <p style={{ margin: '4px 0' }}>긴장이 자주 느껴진 곳: {m.frequent.bodyPart}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AdjustmentCard({ a }: { a: Adjustment }) {
  if (a.kind === 'approachLow') {
    return (
      <div className="card banner">
        <p>지난 2주 동안 다가간 일이 {a.count}번이었어요. 다가가기 사다리의 첫 단계를 더 작게 나눠 볼까요?</p>
        <Link className="btn" to="/m/DB03/basic">
          사다리 다시 만들기
        </Link>
      </div>
    );
  }
  if (a.kind === 'calmingOveruse') {
    return (
      <div className="card banner">
        <p>요즘 진정하는 연습을 주로 하셨어요. 불안이 있어도 한 걸음 다가가는 연습도 함께 해볼까요?</p>
        <Link className="btn" to="/m/AC03/minimal">
          기꺼이 경험하기
        </Link>
      </div>
    );
  }
  return (
    <div className="card notice">
      <p>
        불안 점수(GAD-7)가 최근 {a.totals.length}번 동안 줄지 않았어요 ({a.totals.join(' → ')}점). 지금의 방법을 점검해 볼 때예요(5단계 점검). 이
        앱과 함께 전문가와 이야기해 보는 것도 도움이 될 수 있어요.
      </p>
      <p className="muted" style={{ margin: 0 }}>정신건강복지센터(지역별 무료 상담) · 정신건강의학과 · 정신건강위기상담 1577-0199</p>
    </div>
  );
}
