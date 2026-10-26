// 조합 시퀀스 실행 (2단계 sequences.md, 설계 8.1 작업 14). 소개 → 연습들 → 마무리
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SEQUENCES, getModule } from '../content/load';
import { getCheckin } from '../db/repo';
import { sequenceSteps } from '../domain/sequences';
import type { Checkin } from '../domain/types';
import { ModulePlayer, type PlayerContext } from '../player/ModulePlayer';

export interface SequenceStart {
  checkinId?: string;
  recommendationId?: string;
}

export function Sequence() {
  const { id = '', index: indexParam = '0' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const seq = SEQUENCES.find((q) => q.id === id);
  const start = (location.state as SequenceStart | null) ?? {};
  const [checkin, setCheckin] = useState<Checkin | null | undefined>(start.checkinId ? undefined : null);
  // 앞 연습에서 넘겨받은 값. 화면은 그대로 두고 주소의 순서만 바뀌므로 이 값이 유지된다
  const [carry, setCarry] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (start.checkinId) getCheckin(start.checkinId).then((c) => setCheckin(c ?? null), () => setCheckin(null));
  }, [start.checkinId]);

  if (!seq) {
    return (
      <div>
        <p>이 순서를 찾지 못했어요.</p>
        <Link className="btn" to="/">홈으로</Link>
      </div>
    );
  }
  if (checkin === undefined) return null;

  const steps = sequenceSteps(seq, checkin ?? undefined);
  const index = Math.min(Number(indexParam) || 0, steps.length + 1);
  const go = (i: number) => navigate(`/sequence/${seq.id}/${i}`, { replace: true, state: start });

  if (index === 0) {
    return (
      <div>
        <p className="muted" style={{ marginTop: 8 }}>이어서 하는 순서 · {seq.duration}</p>
        <h1>{seq.title}</h1>
        <p>{seq.why}</p>
        <ol className="card" style={{ paddingLeft: 36 }}>
          {steps.map((st) => {
            const m = getModule(st.module)!;
            return (
              <li key={st.module}>
                {m.name} <span className="muted">· {m.variants[st.variant]?.durationLabel}</span>
              </li>
            );
          })}
        </ol>
        <p className="muted">중간에 멈춰도 괜찮아요. 멈춘 곳에서 다음 연습으로 넘어가거나 그만둘 수 있어요.</p>
        <button type="button" className="btn btn-primary btn-block" onClick={() => go(1)}>
          시작하기
        </button>
      </div>
    );
  }

  if (index > steps.length) {
    return (
      <div>
        <h1>{seq.title}, 마쳤어요.</h1>
        <p>{seq.end}</p>
        <Link className="btn btn-primary btn-block" to="/" replace>
          하던 일로 돌아가기
        </Link>
      </div>
    );
  }

  const st = steps[index - 1];
  const module = getModule(st.module)!;
  const context: PlayerContext = { entry: 'sequence', checkinId: checkin?.id, state: seq.state, carry };
  return (
    <ModulePlayer
      key={index}
      module={module}
      variant={st.variant}
      context={context}
      routine={{
        nextLabel: index === steps.length ? '마치기' : `다음: ${getModule(steps[index].module)!.name}`,
        onNext: (c) => {
          setCarry((prev) => ({ ...prev, ...c }));
          go(index + 1);
        },
      }}
    />
  );
}
