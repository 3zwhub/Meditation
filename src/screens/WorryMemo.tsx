// 걱정 메모 빠른 입력 (CB03 Part 1). 걱정이 올 때 몇 초 안에 적고 하던 일로 돌아간다 (1단계 3장).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addWorryNote, bumpWorryNote, getSettings, listWorryNotes, today } from '../db/repo';
import type { WorryNote } from '../domain/types';
import { TextInput } from '../ui/inputs';

export function WorryMemo() {
  const [text, setText] = useState('');
  const [notes, setNotes] = useState<WorryNote[]>([]);
  const [saved, setSaved] = useState(false);
  const [worryTime, setWorryTime] = useState<string | undefined>();
  const [error, setError] = useState(false);

  const load = async () => setNotes(await listWorryNotes(await today()));
  useEffect(() => {
    load().catch(() => setError(true));
    getSettings().then((s) => setWorryTime(s.worryTime), () => {});
  }, []);

  if (saved) {
    return (
      <div>
        <h1>적어 뒀어요.</h1>
        <p>이 걱정은 {worryTime ? `걱정 시간(${worryTime})` : '저녁 걱정 시간'}에 제대로 다룰 거예요. 그때까지 맡겨 두세요.</p>
        <p>지금은 하던 일로 돌아가 보세요. 걱정이 다시 오면 "아, 이건 이미 적어 뒀지" 하고 넘어가면 돼요.</p>
        <Link className="btn btn-primary btn-block" to="/" replace>
          하던 일로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1>걱정이 찾아왔네요.</h1>
      <TextInput label="한 줄로 적어 두세요." value={text} onChange={setText} example="월말 평가에서 낮은 점수 받으면 어떡하지" />
      {error && <p className="muted">저장하지 못했어요. 다시 눌러 주세요.</p>}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!text.trim()}
        onClick={async () => {
          try {
            await addWorryNote(text.trim());
            setSaved(true);
          } catch {
            setError(true);
          }
        }}
      >
        걱정 메모 저장
      </button>

      {notes.length > 0 && (
        <>
          <h2>오늘 적어 둔 걱정</h2>
          <p className="muted">같은 걱정이 다시 왔다면 새로 적지 말고 "다시 왔어요"만 눌러 주세요.</p>
          <div className="stack">
            {notes.map((n) => (
              <div key={n.id} className="card" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1 }}>{n.text}</span>
                <span className="muted">{n.repeatCount}번</span>
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    await bumpWorryNote(n.id).catch(() => {});
                    await load().catch(() => {});
                  }}
                >
                  다시 왔어요
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
