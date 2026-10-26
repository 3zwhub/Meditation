// 척도 화면 (작업 10). 공식 문항이 아직 없으므로 테스트 전용 가짜 문항으로 흐름만 검증한다.
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { assessmentSchema, type AssessmentContent } from '../../src/content/schema';
import { AppDB, getDB, setDB } from '../../src/db/db';
import { AssessmentScreen } from '../../src/screens/Assessment';

const real = (f: string) => assessmentSchema.parse(JSON.parse(readFileSync(`content/assessments/${f}.json`, 'utf8')));

/** 테스트 전용: 실제 앱에는 들어가지 않는다. */
function withFakeItems(a: AssessmentContent): AssessmentContent {
  return {
    ...a,
    source: { title: '테스트용 가짜 문항', url: 'about:blank', retrievedAt: '2026-01-01' },
    instruction: '테스트 지시문',
    options: ['선택0', '선택1', '선택2', '선택3'],
    items: Array.from({ length: a.itemCount }, (_, i) => `가짜 문항 ${i + 1}`),
  };
}

function renderScreen(content: AssessmentContent) {
  return render(
    <MemoryRouter initialEntries={['/assess']}>
      <Routes>
        <Route path="/assess" element={<AssessmentScreen content={content} />} />
        <Route path="/crisis" element={<p>위기 화면</p>} />
        <Route path="/" element={<p>홈</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function answerAll(scores: number[]) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '시작하기' }));
  for (let i = 0; i < scores.length; i++) {
    const group = screen.getByRole('group', { name: `${i + 1}. 가짜 문항 ${i + 1}` });
    await user.click(group.querySelectorAll('button')[scores[i]] as HTMLElement);
  }
  await user.click(screen.getByRole('button', { name: '결과 보기' }));
  return user;
}

let n = 0;
beforeEach(() => setDB(new AppDB(`assess-${++n}`)));

describe('척도 화면', () => {
  it('공식 문항이 없으면 준비 중을 보여주고 검사를 시작하지 않는다', () => {
    renderScreen(real('phq9'));
    expect(screen.getByText('문항 준비 중이에요.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '시작하기' })).toBeNull();
  });

  it('GAD-7 14점: 중간 구간과 전문가 안내, 결과 저장', async () => {
    renderScreen(withFakeItems(real('gad7')));
    await answerAll([2, 2, 2, 2, 2, 2, 2]);
    expect(await screen.findByText(/GAD-7 14점/)).toBeTruthy();
    expect(screen.getByText('전문가와 이야기해 볼 수 있는 곳')).toBeTruthy();
    expect(screen.getByText('이 점수는 진단이 아니에요. 지난 2주를 돌아보는 참고 자료예요.')).toBeTruthy();
    await expect.poll(async () => (await getDB().assessments.toArray())[0]).toMatchObject({ instrument: 'GAD7', total: 14, band: '중간' });
  });

  it('PHQ-9 9번이 0점이면 안전 확인 없이 결과', async () => {
    renderScreen(withFakeItems(real('phq9')));
    await answerAll([1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(await screen.findByText(/PHQ-9 1점/)).toBeTruthy();
    expect(screen.queryByText('지금 안전한가요?')).toBeNull();
  });

  it('PHQ-9 9번이 1점 이상이면 결과보다 안전 확인이 먼저, "지금은 안전해요" → 연락처를 위에 둔 결과', async () => {
    renderScreen(withFakeItems(real('phq9')));
    const user = await answerAll([0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(await screen.findByRole('heading', { name: '지금 안전한가요?' })).toBeTruthy();
    expect(screen.queryByText(/PHQ-9 1점/)).toBeNull();
    await user.click(screen.getByRole('button', { name: '지금은 안전해요' }));
    expect(await screen.findByText('이런 생각이 들 때 연락할 수 있는 곳')).toBeTruthy();
    expect(screen.getByRole('link', { name: /109/ }).getAttribute('href')).toBe('tel:109');
    await expect.poll(async () => (await getDB().assessments.toArray())[0]?.item9).toBe(1);
    await expect.poll(async () => (await getDB().crisisEvents.toArray())[0]).toMatchObject({ trigger: 'phq9item9', safeAnswer: 'safe' });
  });

  it('"안전하지 않아요" → 위기 화면', async () => {
    renderScreen(withFakeItems(real('phq9')));
    const user = await answerAll([0, 0, 0, 0, 0, 0, 0, 0, 3]);
    await user.click(await screen.findByRole('button', { name: /안전하지 않아요/ }));
    expect(await screen.findByText('위기 화면')).toBeTruthy();
    await expect.poll(async () => (await getDB().crisisEvents.toArray())[0]).toMatchObject({ trigger: 'phq9item9', safeAnswer: 'notSafe' });
  });
});
