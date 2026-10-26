// 작업 13: 처음 실행 (온보딩)
import { expect, test } from '@playwright/test';

test('처음 열면 온보딩: 안내 → 위기 연락처 → 걱정 시간 → 시작, 다음부터는 바로 홈', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '마음 연습에 오신 걸 환영해요' })).toBeVisible();
  await expect(page.getByText('진단이나 전문 치료를 대신하지 않아요.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /위기 안내 열기/ })).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();

  await expect(page.getByRole('heading', { name: '힘들 때 연락할 수 있는 곳' })).toBeVisible();
  await expect(page.getByRole('link', { name: /109/ })).toHaveAttribute('href', 'tel:109');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('걱정 시간').fill('21:00');
  await page.getByRole('button', { name: '이 시간으로 할게요' }).click();

  await expect(page.getByRole('heading', { name: '준비됐어요' })).toBeVisible();
  await expect(page.getByText(/점검\(GAD-7·PHQ-9\)은 준비 중이에요/)).toBeVisible();
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('link', { name: '지금 어때요?' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: '지금 어때요?' })).toBeVisible();
  await page.goto('/#/settings');
  await expect(page.getByLabel('걱정 시간')).toHaveValue('21:00');
});

test('온보딩 중에도 위기 화면은 바로 열리고, 처음 링크가 위기 화면이면 그대로 보여준다', async ({ page }) => {
  await page.goto('/#/crisis');
  await expect(page.getByText('혼자 견디지 않아도 괜찮아요.')).toBeVisible();
  await page.goto('/#/welcome/0');
  await page.getByRole('button', { name: /위기 안내 열기/ }).click();
  await expect(page.getByRole('link', { name: /1577-0199/ })).toBeVisible();
});

test('걱정 시간은 나중에 정해도 된다', async ({ page }) => {
  await page.goto('/#/welcome/2');
  await page.getByRole('button', { name: '나중에 정할게요' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('link', { name: '지금 어때요?' })).toBeVisible();
  await page.goto('/#/settings');
  await expect(page.getByLabel('걱정 시간')).toHaveValue('');
});
