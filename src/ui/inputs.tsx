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

/** 0~100% (믿는 정도 등). 슬라이더는 처음 위치가 곧 값처럼 보여 입력 여부가 모호하므로, 10% 단위 버튼으로 고른다. */
export function PercentInput({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number) => void }) {
  const id = useId();
  const values = Array.from({ length: 11 }, (_, i) => i * 10);
  return (
    <div role="group" aria-labelledby={id} style={{ marginBottom: 20 }}>
      <p id={id} style={{ fontWeight: 600 }}>{label}</p>
      <div className="scale">
        {values.map((v) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} aria-label={`${v}%`} style={{ fontSize: '0.8em' }}>
            {v}
          </button>
        ))}
      </div>
      <div className="scale-ends">
        <span>전혀 아님 (0%)</span>
        <span>확실함 (100%)</span>
      </div>
    </div>
  );
}

type Option = { value: string; label: string; hint?: string };

/** 선택지가 많고 글자가 짧으면(감정 단어·활동·가치 목록) 묶음별 칩으로 보여준다. */
const isCompact = (options: Option[]) => options.length > 8 && options.every((o) => o.label.length <= 18);

export function ChoiceList({
  label,
  options,
  value,
  onChange,
  multi,
}: {
  label: string;
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  multi?: boolean;
}) {
  const id = useId();
  const toggle = (o: Option) => {
    const on = value.includes(o.value);
    onChange(multi ? (on ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value]);
  };

  if (isCompact(options)) {
    const groups = [...new Set(options.map((o) => o.hint ?? ''))];
    return (
      <div role="group" aria-labelledby={id} style={{ marginBottom: 20 }}>
        <p id={id} style={{ fontWeight: 600 }}>{label}</p>
        {groups.map((g) => (
          <div key={g} style={{ marginBottom: 12 }}>
            {g && <p className="muted" style={{ margin: '0 0 6px' }}>{g}</p>}
            <div className="chips">
              {options
                .filter((o) => (o.hint ?? '') === g)
                .map((o) => (
                  <button key={o.value} type="button" className="chip choice" aria-pressed={value.includes(o.value)} onClick={() => toggle(o)}>
                    {o.label}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div role="group" aria-labelledby={id} style={{ marginBottom: 20 }}>
      <p id={id} style={{ fontWeight: 600 }}>{label}</p>
      <div className="choices">
        {options.map((o) => (
          <button key={o.value} type="button" className="choice" aria-pressed={value.includes(o.value)} onClick={() => toggle(o)}>
            {o.label}
            {o.hint && <small>{o.hint}</small>}
          </button>
        ))}
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
