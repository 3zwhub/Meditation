// 7일 막대 (하나의 계열, 0~10). 기록이 없는 날은 0이 아니라 "–"로 둔다.
import { useId, useState } from 'react';

const DOW = ['월', '화', '수', '목', '금', '토', '일'];

export function WeekBars({ title, values, days, unit = '점' }: { title: string; values: (number | undefined)[]; days: string[]; unit?: string }) {
  const id = useId();
  const lastWithData = values.reduce<number>((acc, v, i) => (v !== undefined ? i : acc), -1);
  const [selected, setSelected] = useState(lastWithData);
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  return (
    <figure className="weekbars" aria-labelledby={id}>
      <figcaption id={id} className="weekbars-title">{title}</figcaption>
      <div className="weekbars-plot">
        <div className="weekbars-grid" aria-hidden="true">
          <span style={{ bottom: '100%' }}>10</span>
          <span style={{ bottom: '50%' }}>5</span>
          <span style={{ bottom: '0%' }}>0</span>
        </div>
        <div className="weekbars-cols">
          {values.map((v, i) => (
            <button
              key={days[i]}
              type="button"
              className="weekbars-col"
              aria-pressed={selected === i}
              aria-label={`${DOW[i]}요일 ${v === undefined ? '기록 없음' : `${fmt(v)}${unit}`}`}
              onClick={() => setSelected(i)}
            >
              {selected === i && v !== undefined && <span className="weekbars-value" style={{ bottom: `${v * 10}%` }}>{fmt(v)}</span>}
              {v === undefined ? <span className="weekbars-missing">–</span> : <span className="weekbars-bar" style={{ height: `${Math.max(v * 10, 2)}%` }} />}
            </button>
          ))}
        </div>
      </div>
      <div className="weekbars-days" aria-hidden="true">
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <details className="muted">
        <summary>표로 보기</summary>
        <table className="weekbars-table">
          <tbody>
            {values.map((v, i) => (
              <tr key={days[i]}>
                <th scope="row">
                  {DOW[i]} ({days[i].slice(5).replace('-', '/')})
                </th>
                <td>{v === undefined ? '기록 없음' : `${fmt(v)}${unit}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
