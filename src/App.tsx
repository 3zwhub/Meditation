import { Component, type ReactNode } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getModule } from './content/load';
import { logCrisisEvent } from './db/repo';
import type { VariantKey } from './domain/types';
import { ModulePlayer, type PlayerContext } from './player/ModulePlayer';
import { CrisisButton, CrisisEmphasisProvider } from './safety/CrisisButton';
import { CrisisScreen } from './safety/CrisisScreen';
import { ApproachResult } from './screens/ApproachResult';
import { AssessmentRoute } from './screens/Assessment';
import { CheckIn } from './screens/CheckIn';
import { Home } from './screens/Home';
import { Modules } from './screens/Modules';
import { Recommend } from './screens/Recommend';
import { Routine } from './screens/Routine';
import { WorryMemo } from './screens/WorryMemo';

function PlayerRoute() {
  const { id = '', variant = 'minimal' } = useParams();
  const location = useLocation();
  const module = getModule(id);
  if (!module) {
    return (
      <div>
        <p>이 연습을 찾지 못했어요.</p>
        <Link className="btn" to="/">홈으로</Link>
      </div>
    );
  }
  const context = (location.state as PlayerContext | null) ?? { entry: 'search' };
  // 같은 모듈로 다시 들어와도 새 세션이 되도록 key를 둔다
  return <ModulePlayer key={`${id}/${variant}/${location.key}`} module={module} variant={variant as VariantKey} context={context} />;
}

function CrisisRoute() {
  const navigate = useNavigate();
  return <CrisisScreen onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} />;
}

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const inPlayer = location.pathname.startsWith('/m/') || location.pathname.startsWith('/routine/');
  const onCrisis = location.pathname === '/crisis';
  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-title">마음 연습</span>
        {!onCrisis && (
          <CrisisButton
            onOpen={() => {
              void logCrisisEvent('button');
              navigate('/crisis');
            }}
          />
        )}
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/recommend/:id" element={<Recommend />} />
          <Route path="/modules" element={<Modules />} />
          <Route path="/m/:id/:variant" element={<PlayerRoute />} />
          <Route path="/worry" element={<WorryMemo />} />
          <Route path="/routine/:name/:index" element={<Routine />} />
          <Route path="/assess/:instrument" element={<AssessmentRoute />} />
          <Route path="/approach/:id" element={<ApproachResult />} />
          <Route path="/crisis" element={<CrisisRoute />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      {!inPlayer && !onCrisis && (
        <nav className="bottomnav" aria-label="주요 메뉴">
          <NavLink to="/" end>홈</NavLink>
          <NavLink to="/modules">모든 연습</NavLink>
        </nav>
      )}
    </div>
  );
}

/** 화면에 오류가 나도 위기 연락처는 보여준다. */
class SafeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="app">
        <main>
          <p>화면을 여는 중에 문제가 생겼어요.</p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            다시 열기
          </button>
          <hr style={{ margin: '24px 0' }} />
          <CrisisScreen onBack={() => window.location.reload()} />
        </main>
      </div>
    );
  }
}

export function App() {
  return (
    <SafeBoundary>
      <CrisisEmphasisProvider>
        <HashRouter>
          <Layout />
        </HashRouter>
      </CrisisEmphasisProvider>
    </SafeBoundary>
  );
}
