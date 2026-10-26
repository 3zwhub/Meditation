import { createContext, useContext, useState, type ReactNode } from 'react';

// 기분 0~2점 같은 입력이 있으면 그 화면에서 위기 버튼을 강조한다 (설계 5.2).
const EmphasisContext = createContext<{ emphasis: boolean; setEmphasis: (v: boolean) => void }>({
  emphasis: false,
  setEmphasis: () => {},
});

export function CrisisEmphasisProvider({ children }: { children: ReactNode }) {
  const [emphasis, setEmphasis] = useState(false);
  return <EmphasisContext.Provider value={{ emphasis, setEmphasis }}>{children}</EmphasisContext.Provider>;
}

export const useCrisisEmphasis = () => useContext(EmphasisContext);

/** 위기 버튼을 누르면 진행 중인 모듈이 멈춤으로 저장되도록 알린다. */
export const CRISIS_EVENT = 'meditation:crisis-open';

export function CrisisButton({ onOpen }: { onOpen: () => void }) {
  const { emphasis } = useCrisisEmphasis();
  return (
    <button
      type="button"
      className={`crisis-button${emphasis ? ' emphasis' : ''}`}
      onClick={() => {
        window.dispatchEvent(new Event(CRISIS_EVENT));
        onOpen();
      }}
      aria-label="위기 안내 열기: 지금 도움이 필요해요"
    >
      <span aria-hidden="true">☎</span> {emphasis ? '도움이 필요해요' : '위기'}
    </button>
  );
}
