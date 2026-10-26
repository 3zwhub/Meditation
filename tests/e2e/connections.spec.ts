// 작업 8: 모듈 사이에 값이 넘어가고, 다가간 일이 자동으로 기록된다.
import { expect, test, forward, readStore, runToOutro, startModule } from './helpers';

test('기꺼이 경험하기에서 적은 할 일이 반대 행동으로 넘어간다', async ({ page }) => {
  await startModule(page, 'AC03/minimal');
  await page.locator('textarea').fill('친구에게 먼저 연락하기');
  await runToOutro(page);
  await page.getByRole('button', { name: /^반대 행동 · 1분/ }).click();
  await page.getByRole('button', { name: '점수 없이 바로 시작' }).click();
  await expect(page.locator('textarea')).toHaveValue('친구에게 먼저 연락하기');
});

test('반대 행동을 하면 홈과 저녁 기록에 "다가간 일"이 자동으로 나온다', async ({ page }) => {
  await startModule(page, 'DB03/minimal');
  await page.locator('textarea').fill('친구에게 먼저 연락하기');
  await forward(page).click();
  await page.getByRole('button', { name: '아니요, 불편할 뿐이에요' }).click();
  await forward(page).click();
  await page.locator('textarea').fill('메신저에 잘 지내? 쓰기');
  await forward(page).click();
  await forward(page).click(); // 안내 문장
  await page.getByRole('button', { name: '했어요' }).click();
  await runToOutro(page);
  await page.getByRole('button', { name: '하던 일로 돌아가기' }).click();
  await expect(page.getByText('메신저에 잘 지내? 쓰기')).toBeVisible();

  await startModule(page, 'JR01/basic');
  for (const label of ['오늘 전반적인 불안', '오늘 전반적인 기분', '오늘 에너지']) {
    await page.getByRole('group').filter({ hasText: label }).getByRole('button', { name: '5점' }).click();
    await forward(page).click();
  }
  await expect(page.locator('p', { hasText: '다가간 일:' })).toContainText('메신저에 잘 지내? 쓰기');
});

test('나중에 할 다가가기는 홈 카드에서 결과를 기록한다', async ({ page }) => {
  await startModule(page, 'DB03/minimal');
  await page.locator('textarea').fill('친구에게 먼저 연락하기');
  await forward(page).click();
  await page.getByRole('button', { name: '아니요, 불편할 뿐이에요' }).click();
  await forward(page).click();
  await page.locator('textarea').fill('메신저 열기');
  await forward(page).click();
  await forward(page).click();
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await forward(page).click();
  await page.getByRole('button', { name: '내일' }).click();
  await forward(page).click();
  await expect(page.getByText(/예정된 다가가기/)).toBeVisible();
  await page.getByRole('button', { name: '마치기' }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await page.getByRole('button', { name: '하던 일로 돌아가기' }).click();

  await page.getByRole('link', { name: '결과 기록하기' }).click();
  await expect(page.getByText('메신저 열기')).toBeVisible();
  await page.getByRole('button', { name: '전혀' }).click();
  await page.getByRole('button', { name: '기록하기' }).click();
  await expect(page.getByRole('heading', { name: '한 걸음 다가갔어요.' })).toBeVisible();
  await page.getByRole('link', { name: '홈으로' }).click();
  await expect(page.getByRole('link', { name: '결과 기록하기' })).toHaveCount(0);
  await expect(page.locator('p', { hasText: '다가간 일:' })).toContainText('메신저 열기');
});

test('같은 생각을 사고기록지로 3번 기록하면, 걱정 루프에서 탈융합을 먼저 추천한다', async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await startModule(page, 'CB02/minimal');
    if (i > 0) {
      await page.getByRole('button', { name: /다들 비웃을 것이다/ }).click();
      await forward(page).click();
      await expect(page.locator('textarea')).toHaveValue('다들 비웃을 것이다');
    } else {
      await page.locator('textarea').fill('다들 비웃을 것이다');
    }
    await runToOutro(page);
  }
  expect((await readStore(page, 'thoughts'))[0]).toMatchObject({ recordCount: 3 });

  await page.goto('/#/checkin');
  const groups = page.getByRole('group');
  await groups.filter({ hasText: '불안·긴장' }).getByRole('button', { name: '5점' }).click();
  await groups.filter({ hasText: /^기분/ }).getByRole('button', { name: '5점' }).click();
  await groups.filter({ hasText: '에너지' }).getByRole('button', { name: '5점' }).click();
  await page.getByRole('button', { name: /같은 걱정이 머릿속에서/ }).click();
  await page.getByRole('button', { name: /확인해 볼 수 있는 구체적인 예측/ }).click();
  await page.getByRole('button', { name: '추천 받기' }).click();
  await expect(page.getByText('이 생각은 이미 여러 번 따져 보셨어요.', { exact: false })).toBeVisible();
});

test('홈에서 걱정 메모를 바로 쓰고, 같은 걱정은 "다시 왔어요"로 센다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '+ 걱정 메모' }).click();
  await page.locator('textarea').fill('월말 평가가 걱정된다');
  await page.getByRole('button', { name: '걱정 메모 저장' }).click();
  await page.getByRole('link', { name: '하던 일로 돌아가기' }).click();
  await page.getByRole('link', { name: '+ 걱정 메모' }).click();
  await page.getByRole('button', { name: '다시 왔어요' }).click();
  await expect(page.getByText('2번')).toBeVisible();
});

test('명상 기준점(소리)을 한 번 고르면 다음에도 미리 골라져 있다', async ({ page }) => {
  await startModule(page, 'MD02/minimal');
  await page.getByRole('button', { name: '주변 소리' }).click();
  await startModule(page, 'MD02/minimal');
  await expect(page.getByRole('button', { name: '주변 소리' })).toHaveAttribute('aria-pressed', 'true');
});

test('확언에서 적은 내 가치가 기꺼이 경험하기의 "왜 중요한지"에 참고로 나온다', async ({ page }) => {
  await startModule(page, 'AF01/basic');
  await forward(page).click(); // 안내 문장
  await page.getByRole('button', { name: '친절' }).click();
  await forward(page).click();
  await page.locator('textarea').fill('힘들 때 도움을 받은 적이 있다');
  await forward(page).click();
  await page.locator('textarea').fill('나는 친절한 사람이고 싶다');
  await forward(page).click();
  await page.getByRole('button', { name: '6점' }).click();
  await forward(page).click();
  await page.getByRole('button', { name: '하던 일로 돌아가기' }).click();

  await startModule(page, 'AC03/basic');
  await page.locator('textarea').fill('친구에게 연락하기');
  for (let i = 0; i < 20; i++) {
    if (await page.getByText('내가 적어 둔 가치').isVisible()) break;
    if (await page.getByRole('group').count()) await page.getByRole('group').locator('button.choice').first().click();
    if ((await page.locator('textarea').count()) && !(await page.locator('textarea').inputValue())) await page.locator('textarea').fill('테스트');
    await forward(page).click();
  }
  await expect(page.getByText('나는 친절한 사람이고 싶다', { exact: false })).toBeVisible();
});
