// 작업 12: 설정과 데이터
import { readFileSync } from 'node:fs';
import { type Download } from '@playwright/test';
import { expect, test, readStore, runToOutro, startModule } from './helpers';

test('개인 설정이 추천·화면에 반영된다', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByRole('switch', { name: /호흡보다 그라운딩 먼저/ }).click();
  await expect(page.getByRole('switch', { name: /호흡보다 그라운딩 먼저/ })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: '130%' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--text-scale'))).toBe('1.3');
  await page.getByRole('button', { name: '어둡게' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');

  // 새로 열어도 유지되고, 홈의 바로 시작은 그라운딩이 먼저
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.getByRole('link', { name: '홈' }).click();
  await expect(page.locator('.quick button').first()).toContainText('그라운딩');
});

test('완료 기준: 백업 내보내기 → 모두 지우기 → 가져오기 후 기록이 같다', async ({ page }) => {
  // 기록 만들기: 연습 1개와 걱정 메모 1개
  await startModule(page, 'GR01/minimal');
  await runToOutro(page);
  await page.goto('/#/worry');
  await page.locator('textarea').fill('평가 걱정');
  await page.getByRole('button', { name: '걱정 메모 저장' }).click();
  const before = { sessions: await readStore(page, 'sessions'), worryNotes: await readStore(page, 'worryNotes') };
  expect(before.sessions).toHaveLength(1);

  await page.goto('/#/settings');
  await expect(page.getByText('아직 백업한 적이 없어요.')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /전체 백업 내보내기/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^meditation-backup-\d{8}\.json$/);
  const file = await download.path();
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  expect(backup).toMatchObject({ app: 'meditation', schemaVersion: 1 });
  expect(backup.tables.worryNotes[0].text).toBe('평가 걱정');
  await expect(page.getByText(/마지막 백업: \d{4}-\d{2}-\d{2}/)).toBeVisible();

  // 모두 지우기: "삭제"를 입력해야 버튼이 켜진다
  await page.getByRole('button', { name: '모든 기록 지우기…' }).click();
  const confirm = page.getByRole('button', { name: '모두 지우기' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('삭제 확인 입력').fill('삭제');
  await confirm.click();
  await expect(page.getByText('모든 기록을 지웠어요.')).toBeVisible();
  expect(await readStore(page, 'sessions')).toHaveLength(0);
  expect(await readStore(page, 'worryNotes')).toHaveLength(0);

  // 가져오기(바꾸기): 두 번 확인
  await page.getByLabel('백업 파일 고르기').setInputFiles(file);
  await page.getByRole('button', { name: '지금 기록을 지우고 백업으로 바꾸기' }).click();
  await page.getByRole('button', { name: '네, 백업으로 바꾸기' }).click();
  await expect(page.getByText(/백업으로 바꿨어요/)).toBeVisible();
  expect(await readStore(page, 'sessions')).toEqual(before.sessions);
  expect(await readStore(page, 'worryNotes')).toEqual(before.worryNotes);
});

test('이 앱의 백업이 아닌 파일은 거부하고 기록을 건드리지 않는다', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('백업 파일 고르기').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByText('이 앱의 백업 파일 형식이 아니에요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '지금 기록에 합치기' })).toHaveCount(0);
});

test('CSV 5개를 내보내고, "점수만"이면 직접 쓴 글이 빠진다', async ({ page }) => {
  await startModule(page, 'JR01/minimal');
  await runToOutro(page); // 한 줄 입력에 "테스트 입력"이 들어간다
  await page.goto('/#/settings');
  const downloads: Download[] = [];
  page.on('download', (d) => downloads.push(d));
  await page.getByRole('button', { name: /CSV 내보내기/ }).click();
  await expect.poll(() => downloads.length).toBe(5);
  const journal = downloads.find((d) => d.suggestedFilename().startsWith('journal'))!;
  const text = readFileSync(await journal.path(), 'utf8');
  expect(text.startsWith('﻿날짜,불안,기분,에너지')).toBe(true);
  expect(text).not.toContain('테스트 입력');
});
