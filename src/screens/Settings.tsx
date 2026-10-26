// 설정 (설계 7.1): 개인 설정, 화면, 데이터, 앱 정보
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { deleteAllData, exportBackup, importBackup, parseBackup, type Backup } from '../db/backup';
import { getDB } from '../db/db';
import { getMeta, getSettings, setMeta, today, updateSettings } from '../db/repo';
import { assessmentsCsv, attemptsCsv, checkinsCsv, journalCsv, sessionsCsv } from '../domain/csv';
import { addDays } from '../domain/day';
import type { Settings as SettingsT } from '../domain/types';
import { applyAppearance, downloadText } from '../ui/appearance';

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="choice setting-row" onClick={() => onChange(!on)}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <span className={`switch${on ? ' on' : ''}`} aria-hidden="true" />
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="stack">{children}</div>
    </section>
  );
}

export function Settings() {
  const [s, setS] = useState<SettingsT | null>(null);
  const [lastBackup, setLastBackup] = useState<string | undefined>();
  const [todayDay, setTodayDay] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const reload = async () => {
    const loaded = await getSettings();
    setS(loaded);
    applyAppearance(loaded);
    setLastBackup(await getMeta<string>('lastBackupAt'));
    setTodayDay(await today());
  };
  useEffect(() => {
    reload().catch(() => setMessage('설정을 불러오지 못했어요.'));
  }, []);

  if (!s) return message ? <p className="muted">{message}</p> : null;

  const set = async (patch: Partial<Omit<SettingsT, 'id'>>) => {
    const next = await updateSettings(patch);
    setS(next);
    applyAppearance(next);
  };

  const backupOld = !lastBackup || addDays(lastBackup.slice(0, 10), 30) <= todayDay;

  return (
    <div>
      <h1>설정</h1>
      {message && (
        <div className="card banner" role="status">
          <p style={{ margin: 0 }}>{message}</p>
        </div>
      )}

      <Section title="연습">
        <Toggle
          label="호흡보다 그라운딩 먼저"
          hint="숨에 집중하면 더 불안해질 때. 급할 때 그라운딩을 먼저 추천해요."
          on={s.groundingFirst}
          onChange={(v) => void set({ groundingFirst: v })}
        />
        <Toggle
          label="바디스캔 추천 끄기"
          hint="몸 감각에 집중하면 불편할 때. 대신 바깥 감각을 쓰는 연습을 추천해요."
          on={s.md01Disabled}
          onChange={(v) => void set({ md01Disabled: v })}
        />
        <Toggle label="확언 보여주기" hint="아침 루틴에서 오늘의 확언을 보여줘요." on={s.affirmationsEnabled} onChange={(v) => void set({ affirmationsEnabled: v })} />
        <div className="card" style={{ marginBottom: 0 }}>
          <p style={{ fontWeight: 600 }}>생각 관찰의 돌아올 곳</p>
          <div className="row">
            {(['breath', 'sound'] as const).map((a) => (
              <button key={a} type="button" className="choice chip" aria-pressed={s.meditationAnchor === a} onClick={() => void set({ meditationAnchor: a })}>
                {a === 'breath' ? '호흡' : '주변 소리'}
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <label htmlFor="worryTime" style={{ fontWeight: 600, display: 'block' }}>
            걱정 시간
          </label>
          <p className="muted">잠들기 최소 1시간 전으로 정해 보세요. 저녁 기록 바로 앞에 이어져요.</p>
          <input
            id="worryTime"
            type="time"
            value={s.worryTime ?? ''}
            onChange={(e) => void set({ worryTime: e.target.value || undefined })}
            style={{ minHeight: 48, fontSize: '1em', padding: '0 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}
          />
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <p style={{ fontWeight: 600 }}>TIPP 안전 확인</p>
          <p className="muted">
            {!s.tippScreening.done
              ? '아직 하지 않았어요. TIPP를 처음 쓸 때 물어봐요.'
              : s.tippScreening.restricted
                ? '찬물과 강한 움직임은 빼고, 호흡과 근육 이완만 안내해요.'
                : '찬물·움직임·호흡·근육 이완을 모두 안내해요.'}
          </p>
          {s.tippScreening.done && (
            <button type="button" className="btn" onClick={() => void set({ tippScreening: { done: false, restricted: false } })}>
              다시 확인하기
            </button>
          )}
        </div>
      </Section>

      <Section title="화면">
        <div className="card" style={{ marginBottom: 0 }}>
          <p style={{ fontWeight: 600 }}>글자 크기</p>
          <div className="row" role="group" aria-label="글자 크기">
            {[1, 1.15, 1.3, 1.45, 1.6].map((v) => (
              <button key={v} type="button" className="choice chip" aria-pressed={s.textScale === v} onClick={() => void set({ textScale: v })}>
                {Math.round(v * 100)}%
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <p style={{ fontWeight: 600 }}>테마</p>
          <div className="row" role="group" aria-label="테마">
            {(
              [
                ['system', '기기 설정 따라가기'],
                ['light', '밝게'],
                ['dark', '어둡게'],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" className="choice chip" aria-pressed={s.theme === v} onClick={() => void set({ theme: v })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <DataSection backupOld={backupOld} lastBackup={lastBackup} onChanged={reload} setMessage={setMessage} />

      <Section title="앱 정보">
        <div className="card" style={{ marginBottom: 0 }}>
          <p>
            이 앱은 불안을 다루는 기술을 연습하는 보조 도구이며, 진단이나 전문 치료를 대신하지 않아요. 연습마다 근거 수준은 "모든 연습"에서 볼 수
            있어요.
          </p>
          <p className="muted" style={{ margin: 0 }}>
            기록은 이 기기 안에만 저장되고, 어디로도 보내지 않아요.
          </p>
        </div>
        <Link className="btn btn-block" to="/crisis">
          위기 연락처 보기
        </Link>
      </Section>
    </div>
  );
}

function DataSection({
  backupOld,
  lastBackup,
  onChanged,
  setMessage,
}: {
  backupOld: boolean;
  lastBackup?: string;
  onChanged: () => Promise<void>;
  setMessage: (m: string | null) => void;
}) {
  const [scoresOnly, setScoresOnly] = useState(true);
  const [pending, setPending] = useState<Backup | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');

  const exportJson = async () => {
    const backup = await exportBackup();
    downloadText(`meditation-backup-${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
    await setMeta('lastBackupAt', backup.exportedAt);
    await onChanged();
  };

  const exportCsv = async () => {
    const db = getDB();
    const [checkins, sessions, journals, assessments, attempts] = await Promise.all([
      db.checkins.toArray(),
      db.sessions.toArray(),
      db.journalEntries.toArray(),
      db.assessments.toArray(),
      db.approachAttempts.toArray(),
    ]);
    const suffix = scoresOnly ? '-scores' : '';
    downloadText(`checkins-${stamp}.csv`, checkinsCsv(checkins), 'text/csv');
    downloadText(`sessions${suffix}-${stamp}.csv`, sessionsCsv(sessions, scoresOnly), 'text/csv');
    downloadText(`journal${suffix}-${stamp}.csv`, journalCsv(journals, scoresOnly), 'text/csv');
    downloadText(`assessments-${stamp}.csv`, assessmentsCsv(assessments), 'text/csv');
    downloadText(`approach${suffix}-${stamp}.csv`, attemptsCsv(attempts, scoresOnly), 'text/csv');
  };

  const runImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    try {
      const { added } = await importBackup(pending, mode);
      setMessage(mode === 'replace' ? `백업으로 바꿨어요. (${added}개 기록)` : `기록 ${added}개를 합쳤어요. 이미 있던 기록은 그대로 두었어요.`);
      await onChanged();
    } catch (e) {
      console.error(e);
      setMessage('가져오지 못했어요. 지금 기록은 바뀌지 않았어요.');
    }
    setPending(null);
    setConfirmReplace(false);
  };

  return (
    <section>
      <h2>데이터</h2>
      <div className="stack">
        <div className={`card${backupOld ? ' banner' : ''}`} style={{ marginBottom: 0 }}>
          <p style={{ fontWeight: 600 }}>백업 내보내기</p>
          <p className="muted">
            기록은 이 기기의 브라우저 안에만 있어요. 브라우저 데이터를 지우면 함께 사라지니, 가끔 백업 파일로 저장해 두세요. 백업 파일에는 저널과
            걱정 메모도 들어 있으니 안전한 곳에 보관해 주세요.
          </p>
          <p className="muted">{lastBackup ? `마지막 백업: ${lastBackup.slice(0, 10)}` : '아직 백업한 적이 없어요.'}</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => void exportJson()}>
            전체 백업 내보내기 (JSON)
          </button>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <p style={{ fontWeight: 600 }}>표로 내보내기 (CSV)</p>
          <p className="muted">2~4주마다 하는 점검(5단계)에 쓸 수 있어요.</p>
          <Toggle label="점수만" hint="저널·걱정·생각처럼 직접 쓴 글은 빼고 내보내요." on={scoresOnly} onChange={setScoresOnly} />
          <button type="button" className="btn btn-block" style={{ marginTop: 8 }} onClick={() => void exportCsv()}>
            CSV 내보내기 (파일 5개)
          </button>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <p style={{ fontWeight: 600 }}>백업 가져오기</p>
          <p className="muted">이 앱에서 내보낸 백업 파일(JSON)만 가져올 수 있어요.</p>
          <label className="btn btn-block">
            백업 파일 고르기
            <input
              ref={fileRef}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              aria-label="백업 파일 고르기"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setPending(parseBackup(await file.text()));
                  setMessage(null);
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : '백업 파일을 읽을 수 없어요.');
                }
                if (fileRef.current) fileRef.current.value = '';
              }}
            />
          </label>
          {pending && (
            <div style={{ marginTop: 12 }}>
              <p>{pending.exportedAt.slice(0, 10)}에 만든 백업이에요. 어떻게 가져올까요?</p>
              <div className="stack">
                <button type="button" className="btn btn-block" onClick={() => void runImport('merge')}>
                  지금 기록에 합치기
                </button>
                {confirmReplace ? (
                  <div className="card notice" style={{ marginBottom: 0 }}>
                    <p>지금 이 기기의 기록이 모두 지워지고 백업으로 바뀌어요. 정말 바꿀까요?</p>
                    <div className="row">
                      <button type="button" className="btn" onClick={() => void runImport('replace')}>
                        네, 백업으로 바꾸기
                      </button>
                      <button type="button" className="btn-link" onClick={() => setConfirmReplace(false)}>
                        그만두기
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn btn-block" onClick={() => setConfirmReplace(true)}>
                    지금 기록을 지우고 백업으로 바꾸기
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <p style={{ fontWeight: 600 }}>모든 기록 지우기</p>
          {showDelete ? (
            <>
              <p>
                체크인·연습·저널·걱정 메모·설정이 모두 지워지고 되돌릴 수 없어요. 필요하면 먼저 백업을 내보내세요. 계속하려면 아래에
                <strong> 삭제</strong>라고 입력해 주세요.
              </p>
              <input
                type="text"
                aria-label="삭제 확인 입력"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                style={{ width: '100%', minHeight: 48, padding: '0 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}
              />
              <div className="row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn"
                  style={{ borderColor: 'var(--crisis)', color: 'var(--crisis)' }}
                  disabled={deleteText.trim() !== '삭제'}
                  onClick={async () => {
                    await deleteAllData();
                    setShowDelete(false);
                    setDeleteText('');
                    setMessage('모든 기록을 지웠어요.');
                    await onChanged();
                  }}
                >
                  모두 지우기
                </button>
                <button type="button" className="btn-link" onClick={() => setShowDelete(false)}>
                  그만두기
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => setShowDelete(true)}>
              모든 기록 지우기…
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
