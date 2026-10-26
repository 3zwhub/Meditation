import type { Settings } from '../domain/types';

/** 글자 크기와 테마를 화면에 적용한다 (설계 7.7). */
export function applyAppearance(s: Pick<Settings, 'textScale' | 'theme'>) {
  const root = document.documentElement;
  root.style.setProperty('--text-scale', String(s.textScale));
  if (s.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = s.theme;
}

/** 텍스트 파일을 내려받게 한다. */
export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
