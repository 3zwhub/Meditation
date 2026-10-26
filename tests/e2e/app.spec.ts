import { expect, test, type Page } from '@playwright/test';

const crisisButton = (page: Page) => page.getByRole('button', { name: /위기 안내 열기/ });

async function sessions(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ moduleId: string; status: string; stopReason?: string; post: Record<string, number> }[]>((resolve, reject) => {
        const req = indexedDB.open('meditation');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const all = req.result.transaction('sessions').objectStore('sessions').getAll();
          all.onsuccess = () => resolve(all.result);
        };
      }),
  );
}

test('16. 앱을 열고 2번 탭 안에 모듈을 시작한다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /생리적 한숨/ }).click(); // 1번
  await page.getByRole('button', { name: '점수 없이 바로 시작' }).click(); // 2번
  await expect(page.getByText('편한 자세로 있어도 괜찮아요. 눈은 떠도, 감아도 돼요.')).toBeVisible();
});

test('체크인 → 추천 → 연습 완료 → 홈에 기록', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '지금 어때요?' }).click();
  const groups = page.getByRole('group');
  await groups.filter({ hasText: '불안·긴장' }).getByRole('button', { name: '8점' }).click();
  await groups.filter({ hasText: /^기분/ }).getByRole('button', { name: '5점' }).click();
  await groups.filter({ hasText: '에너지' }).getByRole('button', { name: '5점' }).click();
  await page.getByRole('button', { name: /같은 걱정이 머릿속에서/ }).click();
  await page.getByRole('button', { name: '추천 받기' }).click();

  // 불안 8 + 걱정 루프 → 몸 먼저(A 경로)
  await expect(page.getByRole('heading', { name: '이걸 해볼 수 있어요' })).toBeVisible();
  await expect(page.getByText('불안이 높을 때는 몸부터 진정시키는 게 도움이 될 수 있어요.')).toBeVisible();
  await page.getByRole('button', { name: '시작하기' }).click();

  await page.getByRole('button', { name: '7점' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();
  while (await page.getByRole('button', { name: '다음 단계로' }).isVisible()) {
    await page.getByRole('button', { name: '다음 단계로' }).click();
  }
  await page.getByRole('button', { name: '5점' }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByText(/점수가 그대로여도 괜찮아요/)).toBeVisible();
  await page.getByRole('button', { name: '하던 일로 돌아가기' }).click();
  await expect(page.getByText('오늘 연습 1번. 잘하고 있어요.')).toBeVisible();

  const saved = await sessions(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ moduleId: 'BR01', status: 'completed', post: { anxiety: 5 } });
});

test('1. 모듈 진행 중 위기 버튼 → 위기 화면, 세션은 멈춤으로 저장', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /그라운딩/ }).click();
  await page.getByRole('button', { name: '점수 없이 바로 시작' }).click();
  await crisisButton(page).click();
  await expect(page.getByRole('link', { name: /109/ })).toHaveAttribute('href', 'tel:109');
  await expect(page.getByRole('link', { name: /1577-0199/ })).toHaveAttribute('href', 'tel:15770199');
  await expect(page.getByRole('link', { name: /119/ }).last()).toHaveAttribute('href', 'tel:119');
  await expect.poll(async () => (await sessions(page))[0]).toMatchObject({ status: 'stopped', stopReason: 'crisis' });
});

test('기분 0~2점을 입력하면 위기 버튼을 강조한다', async ({ page }) => {
  await page.goto('/#/checkin');
  await page.getByRole('group').filter({ hasText: /^기분/ }).getByRole('button', { name: '1점' }).click();
  await expect(crisisButton(page)).toHaveText(/도움이 필요해요/);
  await page.getByRole('group').filter({ hasText: /^기분/ }).getByRole('button', { name: '6점' }).click();
  await expect(crisisButton(page)).toHaveText(/위기/);
});

test('4. 오프라인에서도 앱과 위기 화면이 열린다', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // 서비스 워커가 페이지를 제어하게 한다
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await crisisButton(page).click();
  await expect(page.getByText('혼자 견디지 않아도 괜찮아요.')).toBeVisible();
  await expect(page.getByRole('link', { name: /109/ })).toBeVisible();
});

test('5. 기록 저장소가 열리지 않아도 위기 버튼과 연습은 쓸 수 있다', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get() {
        throw new Error('IndexedDB 사용 불가 (테스트)');
      },
    });
  });
  await page.goto('/');
  await expect(page.getByText(/기록을 불러오지 못했어요/)).toBeVisible();
  await page.getByRole('button', { name: /생리적 한숨/ }).click();
  await page.getByRole('button', { name: '점수 없이 바로 시작' }).click();
  await expect(page.getByText('편한 자세로 있어도 괜찮아요. 눈은 떠도, 감아도 돼요.')).toBeVisible();
  await crisisButton(page).click();
  await expect(page.getByRole('link', { name: /109/ })).toBeVisible();
});

test('17. 화면이 꺼졌다 돌아와도 타이머가 실제 경과 시간만큼 진행된다', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#/m/BR01/basic');
  await page.getByRole('button', { name: '점수 없이 바로 시작' }).click();
  await page.clock.fastForward('01:30');
  // 9초짜리 호흡 주기 17번 중, 앞의 안내(약 25초)를 지나 7번째 이후에 있어야 한다
  const counter = page.getByText(/^\d+ \/ 17$/);
  await expect(counter).toBeVisible();
  const [current] = (await counter.textContent())!.split(' / ').map(Number);
  expect(current).toBeGreaterThanOrEqual(6);
  expect(current).toBeLessThanOrEqual(9);
});

test('다른 모듈로 이동하면 처음부터 시작한다', async ({ page }) => {
  await page.goto('/#/m/BR01/minimal');
  await page.getByRole('button', { name: '점수 없이 바로 시작' }).click();
  await page.goto('/#/m/DB02/basic');
  await expect(page.getByRole('heading', { name: 'STOP' })).toBeVisible();
  await expect(page.getByRole('button', { name: '점수 없이 바로 시작' })).toBeVisible();
});
