// 모듈 간 연결 데이터 (작업 8)
import { beforeEach, describe, expect, it } from 'vitest';
import { getModule } from '../../src/content/load';
import { AppDB, getDB, setDB } from '../../src/db/db';
import {
  completeApproachAttempt,
  latestValue,
  listThoughts,
  maxRecentThoughtRecordCount,
  plannedApproachAttempts,
  todayActivity,
} from '../../src/db/repo';
import { attemptStatus, carryForward, saveRecords } from '../../src/player/records';

let n = 0;
beforeEach(() => setDB(new AppDB(`records-${++n}`)));

const CB02 = getModule('CB02')!;
const AC01 = getModule('AC01')!;
const DB03 = getModule('DB03')!;
const AF01 = getModule('AF01')!;

describe('생각 기록과 반복 감지', () => {
  it('CB02로 같은 생각을 고르면 기록 횟수가 오르고, 3회면 반복으로 감지된다', async () => {
    const first = await saveRecords(CB02, 'minimal', { thoughtSelect: 'new', prediction: '다들 비웃을 것이다', beliefAfter: 60 }, { stopped: false });
    const id = first.thoughtId as string;
    for (let i = 0; i < 2; i++) await saveRecords(CB02, 'minimal', { thoughtSelect: id, prediction: '다들 비웃을 것이다' }, { stopped: false });
    const [t] = await listThoughts();
    expect(t).toMatchObject({ id, recordCount: 3, lastBelief: 60 });
    expect(await maxRecentThoughtRecordCount()).toBe(3);
  });

  it('AC01은 생각을 저장하지만 CB02 기록 횟수는 올리지 않는다', async () => {
    await saveRecords(AC01, 'basic', { thought: '망칠 거야', storyTitle: '망칠 거야 이야기' }, { stopped: false });
    const [t] = await listThoughts();
    expect(t).toMatchObject({ text: '망칠 거야', storyTitle: '망칠 거야 이야기', recordCount: 0 });
    expect(await maxRecentThoughtRecordCount()).toBe(0);
  });

  it('멈춘 세션은 생각을 저장하지 않는다', async () => {
    await saveRecords(CB02, 'minimal', { prediction: '아무 일' }, { stopped: true });
    expect(await listThoughts()).toHaveLength(0);
  });
});

describe('다가가기 기록 (다가간 일 자동 기록)', () => {
  it('시도 상태', () => {
    expect(attemptStatus('minimal', { did: 'done' }, false)).toBe('done');
    expect(attemptStatus('minimal', { did: 'later' }, false)).toBe('planned');
    expect(attemptStatus('minimal', { danger: 'yes' }, false)).toBeNull();
    expect(attemptStatus('basic', { f2: 'yes' }, false)).toBeNull();
    expect(attemptStatus('basic', { go: 'now', cameTrue: 'none' }, false)).toBe('done');
    expect(attemptStatus('basic', { go: 'now' }, true)).toBe('stoppedMidway');
    expect(attemptStatus('basic', { go: 'later' }, false)).toBe('planned');
  });

  it('완료한 시도는 오늘의 다가간 일이 되고, 사다리가 저장된다', async () => {
    await saveRecords(
      DB03,
      'basic',
      { task: '회의에서 의견 말하기', l1: '한 문장 적기', l1a: 3, l2: '동의한다고 말하기', l2a: 5, ladderStep: '2', go: 'now', cameTrue: 'none', prediction: '다들 쳐다볼 것이다' },
      { stopped: false },
    );
    const { approached } = await todayActivity();
    expect(approached.map((a) => a.action)).toEqual(['동의한다고 말하기']);
    const [task] = await getDB().approachTasks.toArray();
    expect(task).toMatchObject({ title: '회의에서 의견 말하기', currentStep: 2 });
    expect(task.ladder).toHaveLength(2);
  });

  it('중간에 멈춘 시도도 다가간 일로 센다', async () => {
    await saveRecords(DB03, 'basic', { task: '전화하기', go: 'now' }, { stopped: true });
    expect((await todayActivity()).approached).toHaveLength(1);
  });

  it('불안이 사실에 맞는 경우는 시도로 저장하지 않는다', async () => {
    await saveRecords(DB03, 'minimal', { task: '밤 등산', danger: 'yes' }, { stopped: false });
    expect(await getDB().approachAttempts.count()).toBe(0);
  });

  it('나중에 할 시도는 예정 목록에 있다가, 결과를 기록하면 다가간 일이 된다', async () => {
    await saveRecords(DB03, 'minimal', { task: '친구에게 연락', firstStep: '메신저 열기', did: 'later', when: '내일' }, { stopped: false });
    const [planned] = await plannedApproachAttempts();
    expect(planned).toMatchObject({ action: '메신저 열기', scheduledFor: '내일', status: 'planned' });
    expect((await todayActivity()).approached).toHaveLength(0);
    await completeApproachAttempt(planned.id, { status: 'done', predictionCameTrue: 'none' });
    expect(await plannedApproachAttempts()).toHaveLength(0);
    expect((await todayActivity()).approached).toHaveLength(1);
  });

  it('같은 제목의 일은 하나로 묶인다', async () => {
    await saveRecords(DB03, 'minimal', { task: '친구에게 연락', firstStep: '이름 검색', did: 'done' }, { stopped: false });
    await saveRecords(DB03, 'minimal', { task: ' 친구에게  연락 ', firstStep: '메신저 열기', did: 'done' }, { stopped: false });
    expect(await getDB().approachTasks.count()).toBe(1);
    expect(await getDB().approachAttempts.count()).toBe(2);
  });
});

describe('내 가치', () => {
  it('AF01 가치 쓰기를 저장한다', async () => {
    await saveRecords(AF01, 'basic', { value: '친절', why: '이유', sentence: '나는 친절한 사람이고 싶다', sentenceBelief: 6 }, { stopped: false });
    expect(await latestValue()).toMatchObject({ label: '친절', sentence: '나는 친절한 사람이고 싶다', belief: 6 });
  });
});

describe('다음 모듈로 넘기는 값 (표준 키)', () => {
  it('할 일, 감정, 가치 문장, 생각', () => {
    expect(carryForward({ task: '연락하기', emotion: '불안', sentence: '나는 친절하고 싶다', thought: '망칠 거야' })).toEqual({
      task: '연락하기',
      emotions: ['불안'],
      why: '나는 친절하고 싶다',
      prediction: '망칠 거야',
    });
    expect(carryForward({ emotion: 'other' })).toEqual({});
  });
});
