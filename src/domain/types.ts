// 사용자 기록과 설정의 형태 (설계 2장). domain과 safety는 이 타입만 알고 DB나 React는 모른다.

export type StateId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type ModuleId = string;
export type VariantKey = 'minimal' | 'basic' | 'extended';
export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';
export type ModuleKind = 'calming' | 'cognitive' | 'approach' | 'activation' | 'reflective';

export interface BaseRecord {
  id: string;
  createdAt: string; // ISO 8601, 기기 시간대 포함
  localDate: string; // YYYY-MM-DD, 하루 경계(새벽 4시) 적용
  timeOfDay: TimeOfDay;
}

export type ThoughtKind = 'prediction' | 'whatIf';

export interface Checkin extends BaseRecord {
  anxiety: number;
  mood: number;
  energy: number;
  states: StateId[];
  available: 60 | 180 | 300;
  thoughtKind?: ThoughtKind; // B 상태일 때만 (설계 3.3)
  source: 'manual' | 'morning' | 'evening';
}

export type SessionStatus = 'inProgress' | 'completed' | 'stopped' | 'abandoned';
export type SessionEntry = 'recommendation' | 'quickStart' | 'next' | 'routine' | 'sequence' | 'search';

export interface Session extends BaseRecord {
  moduleId: ModuleId;
  contentVersion: number;
  variant: VariantKey;
  startedAt: string;
  endedAt?: string;
  status: SessionStatus;
  pre: Record<string, number>;
  post: Record<string, number>;
  answers: Record<string, unknown>;
  entry: SessionEntry;
  checkinId?: string;
  fromSessionId?: string;
  stopReason?: 'stopSignal' | 'troubleshooting' | 'crisis' | 'user';
}

export type JournalResponse = 'approached' | 'avoided' | 'checked' | 'usedSkill' | 'endured' | 'unknown';

export interface JournalEntry extends BaseRecord {
  anxiety: number;
  mood: number;
  energy: number;
  oneLine?: string;
  anxiousMoment?: string;
  response?: JournalResponse[];
  responseNote?: string;
  good?: string;
  goodRole?: string;
  autoSummary?: { sessions: ModuleId[]; worryNoteCount: number; approachAttemptIds?: string[] };
  tomorrowTask?: string;
}

/** CB02·AC01에서 다룬 생각. 같은 생각을 CB02로 반복 기록하는지 보기 위해 따로 둔다 (설계 2.3). */
export interface Thought {
  id: string;
  createdAt: string;
  text: string;
  storyTitle?: string;
  patterns: string[];
  recordCount: number; // CB02로 기록한 횟수
  lastRecordedAt?: string; // 마지막 CB02 기록 시각
  lastBelief?: number;
}

/** 다가가고 싶은 일과 사다리 (DB03, AC03). */
export interface ApproachTask {
  id: string;
  createdAt: string;
  title: string;
  ladder: { step: number; action: string; expectedAnxiety?: number }[];
  currentStep?: number;
  archived: boolean;
}

export type AttemptStatus = 'planned' | 'done' | 'stoppedMidway' | 'skipped';

/** 다가가기 시도 1회. done·stoppedMidway가 그날의 "다가간 일"이다 (1단계 5장). */
export interface ApproachAttempt extends BaseRecord {
  approachTaskId: string;
  sessionId?: string;
  action: string; // 실제로 한 (또는 할) 행동
  ladderStep?: number;
  firstStepOnly: boolean;
  factCheck: 'notDanger' | 'danger' | 'unsure';
  prediction?: string;
  confidence?: number;
  safetyBehaviorDropped?: string;
  scheduledFor?: string;
  status: AttemptStatus;
  peakAnxiety?: number;
  outcome?: string;
  predictionCameTrue?: 'none' | 'partly' | 'fully' | 'worse';
  learned?: string;
}

export const APPROACHED: AttemptStatus[] = ['done', 'stoppedMidway'];

/** AF01 가치 확언 쓰기에서 저장하는 내 가치. */
export interface ValueRecord {
  id: string;
  createdAt: string;
  label: string;
  why?: string;
  sentence?: string;
  belief?: number;
}

export interface WorryNote extends BaseRecord {
  text: string;
  anxiety?: number;
  repeatCount: number;
  reviewedAt?: string;
  stillImportant?: boolean;
  controllable?: 'yes' | 'no' | 'unsure';
  nextAction?: string;
}

export interface Assessment extends BaseRecord {
  instrument: 'GAD7' | 'PHQ9';
  answers: number[];
  total: number;
  band: string;
  item9?: number;
}

export interface RecPick {
  module: ModuleId;
  variant: VariantKey;
  reason: string;
}

export interface RecommendationRecord extends BaseRecord {
  checkinId: string;
  state?: StateId;
  primary: RecPick;
  alternatives: RecPick[];
  banner?: string;
  chosen?: 'primary' | 'alt1' | 'alt2' | 'declined' | 'other';
  sessionId?: string;
}

export interface CrisisEvent extends BaseRecord {
  trigger: 'button' | 'phq9item9' | 'lowMood3Days' | 'moduleStopSignal';
  safeAnswer?: 'safe' | 'notSafe' | 'skipped';
}

export interface Settings {
  id: 'settings';
  groundingFirst: boolean;
  tippScreening: { done: boolean; restricted: boolean; answeredAt?: string };
  meditationAnchor: 'breath' | 'sound';
  md01Disabled: boolean;
  worryTime?: string;
  affirmationsEnabled: boolean;
  dayBoundaryHour: number;
  textScale: number;
  theme: 'system' | 'light' | 'dark';
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  groundingFirst: false,
  tippScreening: { done: false, restricted: false },
  meditationAnchor: 'breath',
  md01Disabled: false,
  affirmationsEnabled: true,
  dayBoundaryHour: 4,
  textScale: 1,
  theme: 'system',
};
