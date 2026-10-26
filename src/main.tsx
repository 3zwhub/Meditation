import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getDB } from './db/db';
import { getSettings } from './db/repo';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 글자 크기와 테마를 적용하고, 브라우저가 공간 부족 시 기록을 지우지 않도록 요청한다 (설계 6.2, 7.7).
void (async () => {
  try {
    await getDB().open();
    const s = await getSettings();
    document.documentElement.style.setProperty('--text-scale', String(s.textScale));
    if (s.theme !== 'system') document.documentElement.dataset.theme = s.theme;
  } catch (e) {
    console.error('기록 저장소를 열지 못했어요', e);
  }
  try {
    await navigator.storage?.persist?.();
  } catch {
    // 지원하지 않는 브라우저
  }
})();
