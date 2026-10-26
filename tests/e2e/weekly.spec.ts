// 작업 11: 주간 화면
import { expect, test, forward, runToOutro, startModule } from './helpers';

test('연습·다가간 일·저녁 기록이 주간 화면에 모인다', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 18, 10, 0) }); // 수요일

  // 시작 전·후 점수가 있는 연습
  await page.goto('/#/m/BR01/minimal');
  await page.getByRole('button', { name: '7점' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();
  while (await page.getByRole('button', { name: '다음 단계로' }).isVisible()) await page.getByRole('button', { name: '다음 단계로' }).click();
  await page.getByRole('button', { name: '4점' }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();

  // 다가간 일
  await startModule(page, 'DB03/minimal');
  await page.locator('textarea').fill('메일 답장');
  await forward(page).click();
  await page.getByRole('button', { name: '아니요, 불편할 뿐이에요' }).click();
  await forward(page).click();
  await page.locator('textarea').fill('첫 문장 쓰기');
  await forward(page).click();
  await forward(page).click();
  await page.getByRole('button', { name: '했어요' }).click();
  await runToOutro(page);

  // 저녁 기록 (불안 6)
  await startModule(page, 'JR01/minimal');
  await forward(page).click();
  await page.getByRole('group').filter({ hasText: '오늘 전반적인 불안' }).getByRole('button', { name: '6점' }).click();
  await runToOutro(page);

  await page.goto('/#/week');
  await expect(page.getByRole('heading', { name: '이번 주' })).toBeVisible();
  await expect(page.getByText('11월 16일 ~ 11월 22일')).toBeVisible();
  await expect(page.locator('.stat').filter({ hasText: '연습한 날' })).toContainText('1일');
  await expect(page.locator('.stat').filter({ hasText: '다가간 일' })).toContainText('1번');
  await expect(page.getByRole('button', { name: '수요일 6점' })).toBeVisible();
  await expect(page.getByRole('button', { name: '월요일 기록 없음' }).first()).toBeVisible();
  await expect(page.getByText('첫 문장 쓰기')).toBeVisible();
  await expect(page.getByText(/생리적 한숨 · 1회/)).toContainText('아직 적어요');

  // 지난주로 가면 기록이 없고, 이번 주로 돌아올 수 있다
  await page.getByRole('button', { name: '지난주' }).click();
  await expect(page.getByText('이 주에는 기록이 없어요.')).toBeVisible();
  await page.getByRole('button', { name: '다음 주' }).click();
  await expect(page.getByRole('heading', { name: '이번 주' })).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 주' })).toBeDisabled();
});
