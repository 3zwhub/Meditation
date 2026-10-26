// 작업 7 완료 기준: 16개 모듈을 각 버전마다 끝까지 한 번씩 진행한다.
import { readFileSync, readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const modules = readdirSync('content/modules').map((f) => JSON.parse(readFileSync(`content/modules/${f}`, 'utf8')) as {
  id: string;
  record?: string;
  variants: Record<string, unknown>;
});

async function readStore(page: Page, store: string) {
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

/** 화면에 보이는 입력을 채우고 앞으로 간다. 끝(마무리 화면)에 닿으면 true. */
async function step(page: Page): Promise<boolean> {
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

for (const m of modules) {
  for (const variant of Object.keys(m.variants)) {
    test(`${m.id} ${variant} 버전을 끝까지 진행한다`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));

      await page.goto(`/#/m/${m.id}/${variant}`);
      const noScore = page.getByRole('button', { name: '점수 없이 바로 시작' });
      if (await noScore.isVisible()) await noScore.click();
      else await page.getByRole('button', { name: '시작하기' }).click();

      let done = false;
      for (let i = 0; i < 80 && !done; i++) done = await step(page);
      expect(done, '마무리 화면에 닿지 못했어요').toBe(true);
      await page.getByRole('button', { name: '하던 일로 돌아가기' }).click();
      await expect(page.getByRole('link', { name: '지금 어때요?' })).toBeVisible();

      const sessions = await readStore(page, 'sessions');
      expect(sessions.filter((s) => s.moduleId === m.id && s.status === 'completed')).toHaveLength(1);
      if (m.record === 'journal') expect(await readStore(page, 'journalEntries')).toHaveLength(1);
      expect(errors).toEqual([]);
    });
  }
}
