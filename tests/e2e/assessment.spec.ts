// 작업 10: 공식 한국어판 문항이 들어오기 전에는 검사를 시작할 수 없다.
import { expect, test } from '@playwright/test';

test('모든 연습 → 점수로 돌아보기 → 문항 준비 중', async ({ page }) => {
  await page.goto('/#/modules');
  await page.getByRole('link', { name: /PHQ-9/ }).click();
  await expect(page.getByText('문항 준비 중이에요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '시작하기' })).toHaveCount(0);
  await page.goto('/#/assess/gad7');
  await expect(page.getByText('문항 준비 중이에요.')).toBeVisible();
});

test('문항이 준비되지 않았으면 홈에 검사 안내 카드를 띄우지 않는다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/2주가 지났어요/)).toHaveCount(0);
});
