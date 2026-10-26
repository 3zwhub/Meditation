import { expect, type Page } from '@playwright/test';

export async function readStore(page: Page, store: string) {
  return page.evaluate(
    (name) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const req = indexedDB.open('meditation');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const all = req.result.transaction(name).objectStore(name).getAll();
          all.onsuccess = () => resolve(all.result);
        };
      }),
    store,
  );
}

export async function startModule(page: Page, path: string) {
  // 같은 주소로 다시 이동하면 화면이 바뀌지 않으므로 홈을 거친다
  await page.goto('/#/');
  await page.goto(`/#/m/${path}`);
  const noScore = page.getByRole('button', { name: '점수 없이 바로 시작' });
  if (await noScore.isVisible()) await noScore.click();
  else await page.getByRole('button', { name: '시작하기' }).click();
}

export const forward = (page: Page) => page.locator('.player-footer').last().locator('button').last();

/** 화면에 보이는 입력을 채우고 앞으로 간다. 끝(마무리 화면)에 닿으면 true. */
export async function step(page: Page): Promise<boolean> {
  if (await page.getByRole('button', { name: '하던 일로 돌아가기' }).isVisible()) return true;

  const help = page.getByRole('button', { name: '힘들어요' });
  if (!(await help.isVisible())) {
    // 종료 점수 화면
    await page.getByRole('button', { name: '건너뛰기' }).click();
    return false;
  }

  const body = page.locator('.player-body');
  if (await page.getByRole('button', { name: '해당하는 것이 없다' }).isVisible()) {
    await page.getByRole('button', { name: '해당하는 것이 없다' }).click();
    await page.getByRole('button', { name: '확인' }).click();
    await expect(page.getByText('확인했어요. 이제 TIPP를 시작할게요.')).toBeVisible();
  }
  for (const ta of await body.locator('textarea').all()) {
    if (!(await ta.inputValue())) await ta.fill('테스트 입력');
  }
  if (await page.getByRole('button', { name: '걱정 메모 저장' }).isVisible()) {
    await page.getByRole('button', { name: '걱정 메모 저장' }).click();
  }
  for (const group of await body.getByRole('group').all()) {
    if ((await group.locator('[aria-pressed=true]').count()) > 0) continue;
    const five = group.getByRole('button', { name: '5점', exact: true });
    const half = group.getByRole('button', { name: '50%', exact: true });
    if (await five.count()) await five.click();
    else if (await half.count()) await half.click();
    else await group.locator('button.choice').last().click();
  }

  const forward = page.locator('.player-footer').last().locator('button').last();
  await expect(forward).toBeEnabled();
  await forward.click();
  return false;
}


/** 마무리 화면까지 자동으로 진행한다. */
export async function runToOutro(page: Page) {
  let done = false;
  for (let i = 0; i < 80 && !done; i++) done = await step(page);
  expect(done, '마무리 화면에 닿지 못했어요').toBe(true);
}
