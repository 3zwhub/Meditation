import { useId } from 'react';

/** 0~10 점수. 슬라이더 대신 숫자 버튼 11개로 고른다 (설계 7.7). */
export function ScaleButtons({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const id = useId();
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div role="group" aria-labelledby={id} style={{ marginBottom: 20 }}>
      <p id={id} style={{ fontWeight: 600 }}>{label}</p>
      <div className="scale">
        {values.map((v) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} aria-label={`${v}점`}>
            {v}
          </button>
        ))}
      </div>
      <div className="scale-ends">
        <span>전혀 없음</span>
        <span>가장 강함</span>
      </div>
    </div>
  );
}

/** 0~100% (믿는 정도 등). */
export function PercentInput({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={id} style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>
        {label} <strong>{value ?? '—'}%</strong>
      </label>
      <input id={id} type="range" min={0} max={100} step={10} value={value ?? 50} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%' }} />
    </div>
  );
}

export function ChoiceList({
  label,
  options,
  value,
  onChange,
  multi,
}: {
  label: string;
  options: { value: string; label: string; hint?: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  multi?: boolean;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} style={{ marginBottom: 20 }}>
      <p id={id} style={{ fontWeight: 600 }}>{label}</p>
      <div className="choices">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              className="choice"
              aria-pressed={on}
              onClick={() => onChange(multi ? (on ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value])}
            >
              {o.label}
              {o.hint && <small>{o.hint}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  example,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  example?: string;
}) {
  const id = useId();
  return (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={id} style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>
        {label}
      </label>
      <textarea id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {example && <div className="example">작성 예시: {example}</div>}
    </div>
  );
}
