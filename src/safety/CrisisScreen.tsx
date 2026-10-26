// 위기 화면 (설계 5.3). 네트워크·데이터베이스·콘텐츠 파일에 의존하지 않는 정적 화면이다.
import { CRISIS_CONTACTS } from './contacts';

export function CrisisScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="crisis-page">
      <h1>지금 많이 힘드시군요.</h1>
      <p>혼자 견디지 않아도 괜찮아요.</p>
      <div>
        {CRISIS_CONTACTS.map((c) => (
          <a key={c.tel} className="crisis-call" href={`tel:${c.tel}`}>
            <strong>{c.number}</strong>
            <span>
              {c.label}
              {c.hours && ` · ${c.hours}`}
            </span>
          </a>
        ))}
      </div>
      <h2>지금 바로 할 수 있는 것</h2>
      <ul>
        <li>혼자 있지 않기, 믿을 수 있는 사람에게 연락하기</li>
        <li>위험한 물건에서 멀어지기</li>
        <li>이 화면을 닫지 않고 전화하기</li>
      </ul>
      <p style={{ marginTop: 40 }}>
        <button type="button" className="btn-link" onClick={onBack}>
          돌아가기
        </button>
      </p>
    </div>
  );
}
