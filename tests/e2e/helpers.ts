import { test as base, expect, type Page } from '@playwright/test';

/**
 * 온보딩을 이미 마친 사용자로 시작한다. 위기 화면은 온보딩으로 보내지 않으므로 그곳에서
 * 앱이 기록 저장소를 만들 때까지 기다렸다가 완료 표시를 넣는다. 온보딩 자체는 welcome.spec.ts에서 본다.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto('/#/crisis');
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const tryOnce = (left: number) => {
            const req = indexedDB.open('meditation');
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
              const db = req.result;
              if (!db.objectStoreNames.contains('meta')) {
                db.close();
                if (left <= 0) return reject(new Error('저장소가 만들어지지 않았어요'));
                return setTimeout(() => tryOnce(left - 1), 100);
              }
              const tx = db.transaction('meta', 'readwrite');
              tx.objectStore('meta').put({ key: 'onboardingDone', value: '2026-01-01T00:00:00Z' });
              tx.oncomplete = () => {
                db.close();
                resolve();
              };
            };
          };
          tryOnce(50);
        }),
    );
    await use(page);
  },
});

export { expect };

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
  // 화면이 그려진 뒤에 고른다 (그리기 전에 확인하면 시작 전 점수가 있는 모듈을 잘못 판단한다)
  const start = page.getByRole('button', { name: '시작하기', exact: true });
  await expect(start).toBeVisible();
  const noScore = page.getByRole('button', { name: '점수 없이 바로 시작' });
  if (await noScore.isVisible()) await noScore.click();
  else await start.click();
}

export const forward = (page: Page) => page.locator('.player-footer').last().locator('button').last();

/** 화면에 보이는 입력을 채우고 앞으로 간다. 끝(마무리 화면)에 닿으면 true. */
export async function step(page: Page): Promise<boolean> {
  if (await page.getByRole('button', { name: '하던 일로 돌아가기' }).isVisible()) return true;

  const help = page.getByRole('button', { name: '힘들어요' });
  if (!(await help.isVisible())) {
    // 종료 점수 화면이면 건너뛰고, 아니면 루틴 안의 마무리 화면이다
    const skip = page.getByRole('button', { name: '건너뛰기' });
    if (await skip.isVisible()) {
      await skip.click();
      return false;
    }
    return true;
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
