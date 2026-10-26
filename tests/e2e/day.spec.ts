// 작업 9 완료 기준: 2단계 sequences.md의 하루 일정을 그대로 따라간다.
import { expect, test, type Page } from '@playwright/test';
import { forward, readStore, runToOutro, startModule } from './helpers';

const todayCard = (page: Page) => page.locator('.card').filter({ hasText: '아침 루틴' });

async function scores(page: Page, labels: string[]) {
  for (const label of labels) {
    await page.getByRole('group').filter({ hasText: label }).getByRole('button', { name: '5점', exact: true }).click();
  }
}

async function goHome(page: Page) {
  await page.getByRole('button', { name: '하던 일로 돌아가기' }).click();
  await expect(page.getByRole('link', { name: '지금 어때요?' })).toBeVisible();
}

test('하루 일정: 아침 루틴부터 저녁 기록까지, 다음 날 아침 제안까지', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 2, 7, 30) });

  // 07:30 아침 루틴
  await page.goto('/');
  await todayCard(page).getByRole('link', { name: '시작' }).first().click();
  await scores(page, ['불안·긴장', '기분', '에너지']);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '점수 없이 바로 시작' }).click(); // 느린 호흡
  await runToOutro(page);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '시작하기' }).click(); // 확언
  await runToOutro(page);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByRole('heading', { name: '오늘 다가갈 작은 일 하나' })).toBeVisible();
  await page.locator('textarea').fill('미루던 메일에 답장하기');
  await page.getByRole('button', { name: '이걸로 할게요' }).click();
  await expect(page.getByRole('heading', { name: '아침 루틴을 마쳤어요.' })).toBeVisible();
  await page.getByRole('link', { name: '홈으로' }).click();
  await expect(todayCard(page)).toContainText('✓ 아침 루틴');
  await expect(todayCard(page)).toContainText('다가갈 일: 미루던 메일에 답장하기');
  await expect(todayCard(page)).toContainText('오늘의 확언:');

  // 11:00 회의 직전 — 생리적 한숨
  await page.clock.setSystemTime(new Date(2026, 10, 2, 11, 0));
  await page.getByRole('button', { name: /생리적 한숨/ }).click();
  await page.getByRole('button', { name: '점수 없이 바로 시작' }).click();
  await runToOutro(page);
  await goHome(page);

  // 14:20 걱정이 맴돎 — STOP → 감정 이름 붙이기 → 걱정 메모
  await page.clock.setSystemTime(new Date(2026, 10, 2, 14, 20));
  await startModule(page, 'DB02/minimal');
  await runToOutro(page);
  await goHome(page);
  await startModule(page, 'CB01/minimal');
  await runToOutro(page);
  await goHome(page);
  await page.getByRole('link', { name: '+ 걱정 메모' }).click();
  await page.locator('textarea').fill('상사 메시지 때문에 평가가 걱정된다');
  await page.getByRole('button', { name: '걱정 메모 저장' }).click();
  await page.getByRole('link', { name: '하던 일로 돌아가기' }).click();

  // 16:00 미루던 메일 앞에서 — 기꺼이 경험하기 → 반대 행동
  await page.clock.setSystemTime(new Date(2026, 10, 2, 16, 0));
  await startModule(page, 'AC03/minimal');
  await page.locator('textarea').fill('미루던 메일에 답장하기');
  await runToOutro(page);
  await page.getByRole('button', { name: /^반대 행동 · 1분/ }).click();
  await page.getByRole('button', { name: '점수 없이 바로 시작' }).click();
  await expect(page.locator('textarea')).toHaveValue('미루던 메일에 답장하기');
  await forward(page).click();
  await page.getByRole('button', { name: '아니요, 불편할 뿐이에요' }).click();
  await forward(page).click();
  await page.locator('textarea').fill('첫 문장만 쓰기');
  await forward(page).click();
  await forward(page).click();
  await page.getByRole('button', { name: '했어요' }).click();
  await runToOutro(page);
  await goHome(page);

  // 18:40 지하철에서 갑자기 숨이 가쁨 — 그라운딩
  await page.clock.setSystemTime(new Date(2026, 10, 2, 18, 40));
  await page.getByRole('button', { name: /그라운딩/ }).click();
  await page.getByRole('button', { name: '점수 없이 바로 시작' }).click();
  await runToOutro(page);
  await goHome(page);

  // 21:30 저녁 루틴 — 걱정 시간 → 3줄 기록 → 내일 할 일
  await page.clock.setSystemTime(new Date(2026, 10, 2, 21, 30));
  await todayCard(page).getByRole('link', { name: '시작' }).click();
  await page.getByRole('button', { name: '시작하기' }).click(); // 걱정 시간 (시작 전 점수 없음)
  await forward(page).click(); // 안내 문장
  await expect(page.getByText('상사 메시지 때문에 평가가 걱정된다')).toBeVisible();
  await page.getByRole('button', { name: '지금은 괜찮아요' }).click();
  await runToOutro(page);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '시작하기' }).click(); // 저녁 3줄 기록
  await forward(page).click();
  await scores(page, ['오늘 전반적인 불안']);
  await forward(page).click();
  await scores(page, ['오늘 전반적인 기분']);
  await forward(page).click();
  await scores(page, ['오늘 에너지']);
  await forward(page).click();
  const summary = page.locator('.card').filter({ hasText: '오늘 앱에서 한 것' });
  await expect(summary).toContainText('생리적 한숨 1회');
  await expect(summary).toContainText('걱정 메모 1개');
  await expect(summary).toContainText('다가간 일: 첫 문장만 쓰기');
  await runToOutro(page);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.locator('textarea').fill('회의 전에 하고 싶은 말 한 문장 적기');
  await page.getByRole('button', { name: '내일로 남겨 두기' }).click();
  await page.getByRole('link', { name: '하루 마치기' }).click();
  await expect(todayCard(page)).toContainText('✓ 저녁 기록');
  await expect(todayCard(page)).toContainText('다가간 일: 첫 문장만 쓰기');

  const sessions = await readStore(page, 'sessions');
  const completed = sessions.filter((s) => s.status === 'completed').map((s) => s.moduleId);
  expect(completed).toEqual(expect.arrayContaining(['BR02', 'AF01', 'BR01', 'DB02', 'CB01', 'AC03', 'DB03', 'GR01', 'CB03', 'JR01']));

  // 다음 날 아침: 어제 저녁에 적은 일이 "오늘 다가갈 작은 일" 후보로 나온다
  await page.clock.setSystemTime(new Date(2026, 10, 3, 7, 30));
  await page.goto('/#/');
  await page.reload();
  await expect(todayCard(page)).toContainText('○ 아침 루틴');
  await todayCard(page).getByRole('link', { name: '시작' }).first().click();
  await scores(page, ['불안·긴장', '기분', '에너지']);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '점수 없이 바로 시작' }).click();
  await runToOutro(page);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '시작하기' }).click();
  await runToOutro(page);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByRole('button', { name: /회의 전에 하고 싶은 말 한 문장 적기/ })).toContainText('어제 저녁에 적어 둔 일');
});

test('컨디션이 나쁜 날: 아침 최소 루틴은 체크인과 한숨 3번이면 끝난다', async ({ page }) => {
  await page.goto('/');
  await todayCard(page).getByRole('link', { name: /아침 루틴 최소 버전/ }).click();
  await scores(page, ['불안·긴장', '기분', '에너지']);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '점수 없이 바로 시작' }).click();
  await runToOutro(page);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByRole('heading', { name: '아침 루틴을 마쳤어요.' })).toBeVisible();
  await page.getByRole('link', { name: '홈으로' }).click();
  await expect(todayCard(page)).toContainText('✓ 아침 루틴');
});

test('루틴 중 연습을 멈춰도 다음 순서로 넘어갈 수 있다', async ({ page }) => {
  await page.goto('/#/routine/morning/1');
  await page.getByRole('button', { name: '← 멈추기' }).click();
  await page.getByRole('button', { name: '다음으로 넘어가기' }).click();
  await expect(page.getByRole('button', { name: '시작하기' })).toBeVisible(); // 확언
});
