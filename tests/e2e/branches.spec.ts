// 분기마다 결과가 달라지는 경우 (작업 7)
import { expect, test, type Page } from '@playwright/test';

const next = (page: Page) => page.locator('.player-footer').last().locator('button').last();

async function start(page: Page, path: string) {
  await page.goto(`/#/m/${path}`);
  const noScore = page.getByRole('button', { name: '점수 없이 바로 시작' });
  if (await noScore.isVisible()) await noScore.click();
  else await page.getByRole('button', { name: '시작하기' }).click();
}

test('DB03: 실제 위험이 있다고 답하면 반대 행동 없이 끝나고, "한 걸음 다가갔어요"를 보여주지 않는다', async ({ page }) => {
  await start(page, 'DB03/minimal');
  await page.locator('textarea').fill('밤늦게 혼자 등산 가기');
  await next(page).click();
  await page.getByRole('button', { name: '네, 실제로 위험해요' }).click();
  await next(page).click();
  await expect(page.getByText('그렇다면 불안은 나를 지키는 신호예요.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '마치기' }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.getByRole('button', { name: '하던 일로 돌아가기' })).toBeVisible();
  await expect(page.getByText(/한 걸음 다가갔어요/)).toHaveCount(0);
});

test('CB03: 걱정 메모를 쓰면 걱정 시간 목록에 나오고, 분류가 저장된다', async ({ page }) => {
  await start(page, 'CB03/minimal');
  await next(page).click(); // 안내 문장
  await page.locator('textarea').fill('월말 평가가 걱정된다');
  await page.getByRole('button', { name: '걱정 메모 저장' }).click();
  await expect(page.getByText('적어 뒀어요.')).toBeVisible();

  await start(page, 'CB03/basic');
  await next(page).click(); // 안내 문장
  await expect(page.getByText('월말 평가가 걱정된다')).toBeVisible();
  await page.getByRole('button', { name: '아직 중요해요' }).click();
  await page.getByRole('button', { name: '할 수 있는 일이 있다' }).click();
  await page.locator('textarea').fill('내일 기준표 다시 읽기');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            const req = indexedDB.open('meditation');
            req.onsuccess = () => {
              const all = req.result.transaction('worryNotes').objectStore('worryNotes').getAll();
              all.onsuccess = () => resolve(all.result[0]);
            };
          }),
      ),
    )
    .toMatchObject({ text: '월말 평가가 걱정된다', stillImportant: true, controllable: 'yes', nextAction: '내일 기준표 다시 읽기' });
});

test('DB01: 안전 확인에 해당 항목이 있으면 찬물·움직임 없이 호흡·근육 이완만 안내한다', async ({ page }) => {
  await start(page, 'DB01/basic');
  await page.getByRole('button', { name: /심장 질환이 있거나/ }).click();
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page.getByText(/찬물과 강한 움직임은 빼고/)).toBeVisible();
  await next(page).click();
  await expect(page.getByText('P — 속도 조절 호흡')).toBeVisible();

  // 다음에 열면 다시 묻지 않고, 여전히 찬물 단계가 없다
  await start(page, 'DB01/minimal');
  await expect(page.getByText(/숨을 들이쉬면서 두 주먹을 꽉 쥐고/)).toBeVisible();
});

test('AF01: 믿는 정도가 3점 미만이면 더 약한 문장을 보여준다', async ({ page }) => {
  await start(page, 'AF01/minimal');
  await page.getByRole('button', { name: '1점', exact: true }).click();
  await expect(page.getByText('조금 더 작은 말로 바꿔 볼게요.')).toBeVisible();
  await expect(next(page)).toHaveText('건너뛰기');
  await page.getByRole('group').last().getByRole('button', { name: '1점', exact: true }).click();
  await expect(page.getByText('오늘은 이 문장들이 와닿지 않는 날이네요. 그것도 괜찮아요.')).toBeVisible();
  await expect(next(page)).toHaveText('다음');
});
