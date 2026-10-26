// 작업 7 완료 기준: 16개 모듈을 각 버전마다 끝까지 한 번씩 진행한다.
import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { readStore, runToOutro, startModule } from './helpers';

const modules = readdirSync('content/modules').map((f) => JSON.parse(readFileSync(`content/modules/${f}`, 'utf8')) as {
  id: string;
  record?: string;
  variants: Record<string, unknown>;
});

for (const m of modules) {
  for (const variant of Object.keys(m.variants)) {
    test(`${m.id} ${variant} 버전을 끝까지 진행한다`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));

      await startModule(page, `${m.id}/${variant}`);
      await runToOutro(page);
      await page.getByRole('button', { name: '하던 일로 돌아가기' }).click();
      await expect(page.getByRole('link', { name: '지금 어때요?' })).toBeVisible();

      const sessions = await readStore(page, 'sessions');
      expect(sessions.filter((s) => s.moduleId === m.id && s.status === 'completed')).toHaveLength(1);
      if (m.record === 'journal') expect(await readStore(page, 'journalEntries')).toHaveLength(1);
      expect(errors).toEqual([]);
    });
  }
}
