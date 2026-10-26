// 작업 14: 조합 시퀀스
import { readFileSync } from 'node:fs';
import { beginModule, expect, forward, runToOutro, test } from './helpers';

const seqs = JSON.parse(readFileSync('content/sequences.json', 'utf8')) as { id: string; title: string; steps: unknown[] }[];

for (const q of seqs) {
  test(`${q.id} ${q.title}: 처음부터 마무리까지`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/#/sequence/${q.id}/0`);
    await expect(page.getByRole('heading', { name: q.title })).toBeVisible();
    await page.getByRole('button', { name: '시작하기' }).click();
    const done = page.getByRole('heading', { name: `${q.title}, 마쳤어요.` });
    for (let i = 0; i < 4; i++) {
      // 다음 화면이 그려진 뒤에 판단한다: 마무리이거나 다음 연습의 첫 화면
      await expect(done.or(page.getByRole('button', { name: '시작하기', exact: true }))).toBeVisible();
      if (await done.isVisible()) break;
      await beginModule(page);
      await runToOutro(page);
      await page.getByRole('button', { name: /^(다음: .+|마치기)$/ }).click();
    }
    await expect(page.getByRole('heading', { name: `${q.title}, 마쳤어요.` })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('추천 화면에서 "시퀀스로 하기" (감정 폭주 → TIPP → STOP)', async ({ page }) => {
  await page.goto('/#/checkin');
  const groups = page.getByRole('group');
  await groups.filter({ hasText: '불안·긴장' }).getByRole('button', { name: '9점' }).click();
  await groups.filter({ hasText: /^기분/ }).getByRole('button', { name: '4점' }).click();
  await groups.filter({ hasText: '에너지' }).getByRole('button', { name: '5점' }).click();
  await page.getByRole('button', { name: /감정이 너무 커서/ }).click();
  await page.getByRole('button', { name: '추천 받기' }).click();
  await page.getByRole('button', { name: /시퀀스로 하기: 감정이 폭주할 때/ }).click();
  await expect(page.getByRole('listitem')).toHaveText([/TIPP/, /STOP/]);
});

test('시퀀스 2: 체크인에서 "확인해 볼 수 있는 예측"을 고르면 마지막이 사고기록지', async ({ page }) => {
  await page.goto('/#/checkin');
  const groups = page.getByRole('group');
  for (const label of ['불안·긴장', '에너지']) await groups.filter({ hasText: label }).getByRole('button', { name: '5점' }).click();
  await groups.filter({ hasText: /^기분/ }).getByRole('button', { name: '5점' }).click();
  await page.getByRole('button', { name: /같은 걱정이 머릿속에서/ }).click();
  await page.getByRole('button', { name: /확인해 볼 수 있는 구체적인 예측/ }).click();
  await page.getByRole('button', { name: '추천 받기' }).click();
  await page.getByRole('button', { name: /시퀀스로 하기: 걱정이 멈추지 않을 때/ }).click();
  await expect(page.getByRole('listitem')).toHaveText([/STOP/, /감정 이름 붙이기/, /간이 사고기록지/]);
});

test('시퀀스 3: 기꺼이 경험하기에서 적은 할 일이 반대 행동으로 이어진다', async ({ page }) => {
  await page.goto('/#/sequence/SEQ3/0');
  await page.getByRole('button', { name: '시작하기' }).click();
  await beginModule(page); // 느린 호흡
  await runToOutro(page);
  await page.getByRole('button', { name: '다음: 기꺼이 경험하기' }).click();
  await beginModule(page);
  await page.locator('textarea').fill('미루던 메일에 답장하기');
  await forward(page).click();
  await runToOutro(page);
  await page.getByRole('button', { name: '다음: 반대 행동' }).click();
  await beginModule(page);
  await expect(page.locator('textarea')).toHaveValue('미루던 메일에 답장하기');
});
