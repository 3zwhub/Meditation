# 3단계 결과물: 데이터 구조와 시스템 설계

> `prompts/03-data-structure.md`를 실행한 결과입니다. `docs/01-framework.md`(1단계)와 `docs/02-modules/`(2단계)를 기준으로 하며, 4단계 구현은 이 문서를 그대로 따릅니다.
> 용어와 ID(모듈 ID, 상태 A~F, 메커니즘 ①~⑦)는 1·2단계와 같습니다.

## 0. 구현 환경

| 항목 | 결정 | 이유 |
|---|---|---|
| 산출물 형태 | 웹앱(PWA) | 1단계 7.1 |
| 사용자 | 나 혼자 | 계정·서버·동기화가 필요 없음 |
| 데이터 저장 | 기기 안에만(IndexedDB) | 민감한 기록을 외부로 보내지 않음. 백업은 내보내기 파일로 |
| 네트워크 | 처음 설치할 때만 필요, 이후 완전 오프라인 | 위기 안내가 네트워크 없이 보여야 함(1단계 6.2) |
| 기술 스택 | 아래 7.3 | 기술 선호가 정해지지 않아, 혼자 유지보수하기 쉽고 자료가 많은 조합으로 선택 |

---

## 1. 콘텐츠 데이터 모델

### 1.1 원칙
- **콘텐츠는 코드와 분리합니다.** 모듈 스크립트·확언·감정 단어·활동 목록은 `content/` 폴더의 JSON 파일이고, 앱 코드는 이 파일을 읽어 화면을 그립니다. 문구를 고치거나 모듈을 추가할 때 코드를 건드리지 않습니다.
- **2단계 문서(`docs/02-modules/*.md`)가 원본입니다.** JSON은 원본을 옮긴 것이며, 문구가 다르면 원본을 고친 뒤 JSON에 반영합니다. 4단계에서 둘이 일치하는지 확인하는 테스트(모듈 ID·단계 수·필수 항목)를 둡니다.
- **콘텐츠에는 버전이 있습니다.** 사용자 기록은 어떤 버전의 모듈을 했는지 함께 저장해, 나중에 스크립트를 고쳐도 과거 기록의 해석이 흔들리지 않게 합니다.

### 1.2 엔티티

| 엔티티 | 설명 | 관계 |
|---|---|---|
| `Mechanism` | 메커니즘 ①~⑦ | Module N:M |
| `State` | 상태 A~F | Module N:M (적합/피해야 할) |
| `Module` | 모듈 하나 (A~E 형식) | Variant 1:N, Reference N:M |
| `Variant` | 최소/기본/확장 버전 | Step 1:N |
| `Step` | 화면 한 장 또는 안내 한 줄 | 종류별로 다른 필드 |
| `Affirmation` | 확언 한 문장과 약한 버전 | 형태(수용/과정/가치/자기자비), State N:M |
| `Sequence` | 조합 시퀀스 1~5 | Module 순서 목록 |
| `Reference` | 참고문헌 | Module N:M |
| `Lexicon` | 감정 단어, 활동 목록, 가치 목록, 생각 패턴, 이름표 | 모듈의 선택지에서 참조 |
| `Assessment` | GAD-7, PHQ-9 문항과 점수 구간 | 독립 |

### 1.3 필드 정의

**Module**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | string | ✅ | `BR01` 등 1단계 4장 ID |
| `contentVersion` | number | ✅ | 문구가 바뀔 때마다 1씩 증가 |
| `name` | string | ✅ | "생리적 한숨" |
| `category` | `"breath" \| "grounding" \| "meditation" \| "cbt" \| "act" \| "dbt" \| "journal" \| "affirmation"` | ✅ | ID 접두어와 대응 |
| `mechanisms` | `MechanismId[]` | ✅ | `["m1"]` |
| `states.suitable` | `StateId[]` | ✅ | `["A","C"]` |
| `states.avoid` | `AvoidRule[]` | ✅ | 피해야 할 조건과 대체 모듈. 예: `{ when: "anxiety>=8", use: ["BR01","GR01"] }` |
| `kind` | `"calming" \| "cognitive" \| "approach" \| "activation" \| "reflective"` | ✅ | 조정 규칙에서 씀. 진정 = BR·GR·DB01, 다가가기 = AC03·DB03 |
| `evidence` | `{ level: "strong"\|"moderate"\|"preliminary"\|"hypothesis", note: string }` | ✅ | 2단계 "근거에 대한 메모" |
| `intro` | `string[]` | ✅ | B. 시작 전 안내 문단 |
| `preMeasure` / `postMeasure` | `ScaleRef` | ✅ | 시작·종료 점수. 예: `{ id: "anxiety", label: "지금 불안·긴장은 몇 점인가요?" }` |
| `variants` | `{ minimal: Variant, basic: Variant, extended?: Variant }` | ✅ | |
| `outro` | `{ message: string, reflection?: Step, next: NextRule[] }` | ✅ | D. 마무리 |
| `troubleshooting` | `{ problem: string, answer: string, action?: ModuleId }[]` | ✅ | E. 문제가 생길 때 |
| `stopSignals` | `{ text: string, action: ModuleId \| "crisis" }` | ✅ | 즉시 멈춰야 하는 신호 |
| `setup` | `Step[]` | — | 처음 사용할 때 한 번 (DB01 안전 확인, CB03 걱정 시간 정하기) |
| `references` | `ReferenceId[]` | — | |

**Variant**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `durationLabel` | string | ✅ | "1분", "2~3분" |
| `estimatedSec` | number | ✅ | 추천 시 가용 시간과 비교 |
| `steps` | `Step[]` | ✅ | |

**Step** (종류 `type`에 따라 필드가 다름)

| type | 필드 | 화면 |
|---|---|---|
| `say` | `text`, `pauseSec?` | 안내 문장 한 줄. `pauseSec`만큼 다음 줄을 늦게 보여줌 |
| `pacer` | `pattern`(`[{phase:"in"\|"in2"\|"hold"\|"out", sec}]`), `cycles` 또는 `durationSec`, `cues?`(`{atSec, text}[]`) | 호흡 원 애니메이션. BR01·BR02·DB01 |
| `timer` | `sec`, `label`, `skippable?` | 카운트다운 (TIPP 찬물 30초 등) |
| `scale` | `id`, `label`, `min`(0), `max`(10 또는 100), `unit?`("%") | 0~10 슬라이더 / 0~100% |
| `choice` | `id`, `label`, `options`(`{value,label,next?}[]`), `multi?`, `lexicon?` | 버튼 선택. `lexicon`이면 감정 단어 등 공용 목록 사용 |
| `text` | `id`, `label`, `placeholder?`, `example?`, `optional?` | 짧은 입력과 작성 예시 |
| `exit` | `text` | 모듈을 여기서 끝냄 (DB03의 "불안이 사실에 맞는 경우"). 이렇게 끝나면 마무리 문장을 숨김 |
| `worryMemo` | `label`, `example?` | 걱정 한 줄을 `worryNotes`에 저장 (CB03 최소) |
| `worryReview` | — | 오늘의 걱정 메모를 다시 보고 분류 (CB03 기본) |
| `affirmation` | — | 상태에 맞는 확언과 믿는 정도, 3점 미만이면 약한 버전 (AF01) |
| `tippScreening` | — | 처음 한 번 하는 안전 확인, 결과는 설정에 저장 (DB01) |
| `todaySummary` | — | 오늘 앱에서 한 것 자동 요약 (JR01) |
| `thoughtSelect` | `fillInto` | 이전에 기록한 생각과 같은지 고르고, 고르면 `fillInto` 단계에 그 생각을 채움 (CB02, 같은 생각 반복 기록 감지) |

- 모든 step에는 `id`가 있고, `showIf`(조건식)로 보여줄지 정할 수 있습니다. 답에 따른 분기는 이 `showIf`로 표현합니다.
- 몸 부위·감정 단어·활동·가치·생각 패턴 같은 공용 선택지는 `choice`의 `lexicon`(`content/lexicon/*.json`)으로 씁니다. 몸 그림 선택(`bodyMap`)은 2차로 미뤘습니다.
- `scale`과 시작 전·후 점수에는 `crisisEmphasisAtOrBelow`를 둘 수 있습니다. 그 점수 이하를 고르면 위기 버튼을 강조합니다(CB05·JR01의 기분 0~2점).
- 문장 안의 `{변수}`는 같은 세션의 입력 `id`나 이전 단계 값(`{before}`, `{현재 시각}`)으로 채워집니다. 선택지 답은 보이는 글자로 채워집니다.
- 저녁 기록(JR01)처럼 전후 점수가 없는 모듈은 `preMeasure`·`postMeasure`를 비웁니다.
- `record`는 모듈을 마칠 때 답을 옮겨 저장할 곳입니다: `journal`(JR01 → `journalEntries`), `thought`(CB02·AC01 → `thoughts`), `approach`(DB03 → `approachTasks`·`approachAttempts`, 멈춘 경우도 저장), `value`(AF01 → `values`). 구현은 `src/player/records.ts`.
- `choice`의 `setting`은 그 설정 값으로 미리 고르고, 고르면 설정에 기억합니다(MD02의 호흡/소리 → `settings.meditationAnchor`).
- 다음 모듈로 넘어갈 때 표준 키(2.3 표)의 값이 함께 넘어가, 받는 모듈에 같은 id의 단계가 있으면 미리 채워집니다(`task`, `emotions`, `bodyParts`, AF01 `sentence` → AC03 `why`, AC01 `thought` → CB02 `prediction`).

**Affirmation**

| 필드 | 타입 | 필수 |
|---|---|---|
| `id` | string (`AF-ACC-01` 등) | ✅ |
| `form` | `"acceptance" \| "process" \| "value" \| "compassion"` | ✅ |
| `text` | string | ✅ |
| `weaker` | string | ✅ |
| `states` | `StateId[]` | ✅ |
| `needs` | `("value" \| "task")[]` | — (가치형의 `{가치}`, `{할 일}` 자리) |

**Sequence**

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | `SEQ1`~`SEQ5` | 2단계 `sequences.md` |
| `state` | `StateId` | |
| `steps` | `{ module, variant, partial?: stepIds[] }[]` | |
| `branches` | `{ after, if, goto }[]` | 시퀀스 2의 갈림길 등 |

### 1.4 예시: BR01 최소 버전을 JSON으로

```json
{
  "id": "BR01",
  "contentVersion": 1,
  "name": "생리적 한숨",
  "category": "breath",
  "mechanisms": ["m1"],
  "states": {
    "suitable": ["A", "C", "D"],
    "avoid": [
      { "when": "setting.groundingFirst", "use": ["GR01"], "reason": "호흡에 집중하면 더 불안해지는 경우" }
    ]
  },
  "kind": "calming",
  "evidence": {
    "level": "preliminary",
    "note": "하루 5분씩 한 달 연습한 연구(Balban et al., 2023)에 기반. 즉시 효과는 예비 근거."
  },
  "intro": [
    "사람은 긴장이 쌓이면 저절로 한숨을 쉬어요. 이 연습은 그 한숨을 일부러, 천천히 해보는 거예요.",
    "숨을 짧게 두 번 들이쉬고 길게 내쉬면, 내쉬는 숨이 몸에 '이제 조금 느슨해져도 된다'는 신호를 보내는 데 도움이 될 수 있어요."
  ],
  "preMeasure": { "id": "anxiety", "label": "지금 불안·긴장은 몇 점인가요?" },
  "postMeasure": { "id": "anxiety", "label": "지금 불안·긴장은 몇 점인가요?" },
  "variants": {
    "minimal": {
      "durationLabel": "30초~1분",
      "estimatedSec": 45,
      "steps": [
        { "id": "s1", "type": "say", "text": "편한 자세로 있어도 괜찮아요. 눈은 떠도, 감아도 돼요.", "pauseSec": 2 },
        {
          "id": "s2", "type": "pacer",
          "pattern": [
            { "phase": "in", "sec": 2 },
            { "phase": "in2", "sec": 1 },
            { "phase": "out", "sec": 5 }
          ],
          "cycles": 3,
          "cues": [
            { "atSec": 0, "text": "코로 숨을 들이쉬세요." },
            { "atSec": 2, "text": "끝에서 한 번 더, 짧게 들이쉬세요." },
            { "atSec": 3, "text": "이제 입으로 천천히, 길게 내쉬세요." }
          ]
        },
        { "id": "s3", "type": "say", "text": "잘하셨어요. 이제 평소처럼 숨 쉬세요." }
      ]
    },
    "basic": { "durationLabel": "3분", "estimatedSec": 180, "steps": ["…생략: 2단계 BR01.md 기본 버전"] }
  },
  "outro": {
    "message": "점수가 그대로여도 괜찮아요. 이 연습은 불안을 없애는 게 아니라, 다음 걸음을 뗄 수 있을 만큼 몸을 정돈하는 거예요.",
    "reflection": {
      "id": "r1", "type": "choice", "label": "숨을 내쉴 때 몸의 어느 부분이 가장 먼저 느슨해졌나요?",
      "options": [
        { "value": "shoulder", "label": "어깨" }, { "value": "jaw", "label": "턱" },
        { "value": "chest", "label": "가슴" }, { "value": "belly", "label": "배" },
        { "value": "unknown", "label": "잘 모르겠음" }
      ]
    },
    "next": [
      { "if": "post.anxiety>=7", "module": "GR01", "variant": "minimal" },
      { "if": "post.anxiety>=4", "module": "CB01", "variant": "minimal" },
      { "if": "context.avoiding", "module": "AC03", "variant": "minimal" },
      { "if": "true", "action": "returnToTask" }
    ]
  },
  "troubleshooting": [
    { "problem": "어지럽거나 손끝이 저려요", "answer": "숨을 너무 많이, 빨리 쉬고 있을 수 있어요. 들이쉬는 양을 줄이고 평소 숨으로 몇 번 쉬세요.", "action": "GR01" },
    { "problem": "숨에 집중하니까 오히려 더 불안해져요", "answer": "바로 눈을 뜨고 GR01로 바꾸세요. 앞으로는 GR01을 먼저 추천하도록 설정할 수 있어요.", "action": "GR01", "setSetting": "groundingFirst" }
  ],
  "stopSignals": [
    { "text": "가슴 통증, 심한 어지러움, 숨이 막혀 공황이 커지는 느낌", "action": "GR01" }
  ],
  "references": ["balban2023"]
}
```

`troubleshooting[].setSetting`처럼 개인 설정을 바꾸는 항목은 사용자가 그 문제를 눌렀을 때 "앞으로 이렇게 바꿀까요?" 확인을 거쳐 설정에 저장합니다(1단계 2장 개인 설정).

### 1.5 조건식
`if`, `when`에는 아래 변수만 쓰는 작은 조건식을 씁니다. 임의의 코드를 실행하지 않고, 4단계에서 정해진 문법만 해석하는 함수로 구현합니다.
- `pre.<scaleId>`, `post.<scaleId>`: 이번 세션 전후 점수
- `answer.<stepId>`: 이번 세션의 입력 값
- `checkin.<anxiety|mood|energy>`: 가장 최근 체크인
- `setting.<key>`: 개인 설정
- `context.<avoiding|fromModule>`: 이전 모듈에서 넘어온 정보
- 연산자: `>=`, `<=`, `==`, `!=`, `&&`, `||`, `in`

---

## 2. 사용자 기록 데이터 모델

### 2.1 공통 규칙
- 모든 기록은 `id`(UUID), `createdAt`(ISO 8601, 기기 시간대 포함), `localDate`(`YYYY-MM-DD`, 기기 시간대 기준), `timeOfDay`(`morning` 05~11시 / `day` 11~18시 / `evening` 18~23시 / `night` 23~05시)를 가집니다. 분석 기준을 하나로 맞추기 위해서입니다.
- **하루의 경계는 새벽 4시**입니다. 새벽 1시에 쓴 저녁 기록은 전날 기록으로 봅니다.
- 점수는 모두 정수 0~10(믿는 정도는 0~100)입니다.
- 수정 가능한 기록은 `updatedAt`을 가집니다. 삭제는 실제로 지웁니다(휴지통 없음, 7.6 참고).

### 2.2 엔티티

| 엔티티 (IndexedDB 테이블) | 설명 | 주요 관계 |
|---|---|---|
| `checkins` | 체크인 | — |
| `sessions` | 모듈 1회 수행 | `checkinId?`, `sequenceRunId?` |
| `worryNotes` | 걱정 메모 | 걱정 시간 `sessionId?` |
| `thoughts` | CB02·AC01에서 다룬 생각 | `sessions` N:M |
| `approachTasks` | 다가가고 싶은 일과 사다리 | `approachAttempts` 1:N |
| `approachAttempts` | 다가가기 시도 1회 (DB03) | `approachTaskId`, `sessionId` |
| `journalEntries` | 저녁 3줄 기록 | — |
| `assessments` | GAD-7, PHQ-9 | — |
| `values` | 내 가치 | `sessions`에서 참조 |
| `recommendations` | 추천 기록(무엇을 추천했고 받아들였는지) | `checkinId`, 선택된 `sessionId?` |
| `crisisEvents` | 위기 안내가 열린 기록 | — |
| `settings` | 개인 설정 (한 행) | — |
| `meta` | 스키마 버전, 온보딩 완료 여부 | — |

### 2.3 필드 정의와 예시

**checkins**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `anxiety`, `mood`, `energy` | 0~10 | ✅ | |
| `states` | `StateId[]` | ✅ | 1개 이상. 사용자가 고른 것 |
| `available` | `60 \| 180 \| 300` | ✅ | 초 단위 가용 시간 |
| `source` | `"manual" \| "morning" \| "evening"` | ✅ | 하루 3회 권장 제한은 `manual`만 셈(1단계 6.4) |

```json
{ "id": "c-7f3a…", "createdAt": "2026-11-02T14:20:11+09:00", "localDate": "2026-11-02", "timeOfDay": "day",
  "anxiety": 6, "mood": 5, "energy": 4, "states": ["B"], "available": 180, "source": "manual" }
```

**sessions**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `moduleId`, `contentVersion`, `variant` | | ✅ | |
| `startedAt`, `endedAt?` | ISO | ✅/— | 중간에 멈추면 `endedAt` 없이 `status: "stopped"` |
| `status` | `"completed" \| "stopped" \| "abandoned"` | ✅ | stopped = 사용자가 멈춤, abandoned = 앱을 닫음 |
| `pre`, `post` | `{ [scaleId]: number }` | ✅/— | 모듈의 preMeasure/postMeasure |
| `answers` | `{ [stepId]: any }` | ✅ | 입력 값 전체 |
| `entry` | `"recommendation" \| "quickStart" \| "next" \| "routine" \| "sequence" \| "search"` | ✅ | 어떻게 시작했는지 |
| `checkinId?`, `fromSessionId?`, `sequenceRunId?` | | — | |
| `stopReason?` | `"stopSignal" \| "troubleshooting" \| "crisis" \| "user"` | — | |

```json
{ "id": "s-91c2…", "createdAt": "2026-11-02T14:21:03+09:00", "localDate": "2026-11-02", "timeOfDay": "day",
  "moduleId": "DB02", "contentVersion": 1, "variant": "minimal",
  "startedAt": "2026-11-02T14:21:03+09:00", "endedAt": "2026-11-02T14:22:10+09:00", "status": "completed",
  "pre": { "urge": 7 }, "post": { "urge": 4 },
  "answers": { "urgeAction": "평가 기준 다시 검색하기" },
  "entry": "recommendation", "checkinId": "c-7f3a…" }
```

**worryNotes**

| 필드 | 타입 | 설명 |
|---|---|---|
| `text` | string | |
| `anxiety?` | 0~10 | |
| `repeatCount` | number | 같은 걱정이 다시 와서 누른 횟수 |
| `reviewedAt?`, `stillImportant?`, `controllable?` | | 걱정 시간에서 채움 |
| `nextAction?`, `nextActionWhen?` | string | "할 수 있는 일"일 때 |

**thoughts** (CB02 반복 기록 감지용, 1단계 5장 조정 규칙)

| 필드 | 타입 | 설명 |
|---|---|---|
| `text` | string | 자동적 생각 원문 |
| `storyTitle?` | string | AC01의 이야기 제목 |
| `patterns` | string[] | CB02 4번 생각 패턴 |
| `recordCount` | number | 이 생각을 CB02로 기록한 횟수 |
| `lastBelief?` | 0~100 | |

새 CB02를 시작할 때 "이전에 기록한 생각" 목록에서 같은 생각을 고르면 `recordCount`가 올라갑니다(MVP는 글 유사도 계산 없이 사용자 선택으로만 판별).

**approachTasks / approachAttempts** (DB03, AC03)

| 엔티티 | 필드 |
|---|---|
| `approachTasks` | `title`, `valueId?`, `ladder: { step, action, expectedAnxiety }[]`, `currentStep`, `archived` |
| `approachAttempts` | `approachTaskId`, `ladderStep?`, `firstStepOnly`(최소 버전), `factCheck: "notDanger"\|"danger"\|"unsure"`, `prediction?`, `confidence?`(0~100), `safetyBehaviorDropped?`, `scheduledFor?`, `status: "planned"\|"done"\|"stoppedMidway"\|"skipped"`, `peakAnxiety?`, `afterAnxiety?`, `outcome?`, `predictionCameTrue?: "none"\|"partly"\|"fully"\|"worse"`, `learned?` |

`status`가 `done` 또는 `stoppedMidway`이면 그날의 **"다가간 일"**로 셉니다(1단계 5장: 중간에 멈춘 시도 포함).

**journalEntries** (JR01)

| 필드 | 타입 | 설명 |
|---|---|---|
| `anxiety`, `mood`, `energy` | 0~10 | 하루 점수. `mood`가 하루 대표 기분 점수의 1순위 |
| `oneLine?` | string | 최소 버전 |
| `anxiousMoment?` | string | ① |
| `response?` | `("approached"\|"avoided"\|"checked"\|"usedSkill"\|"endured"\|"unknown")[]` | ② |
| `responseSkills?` | ModuleId[] | ② 기술 사용 시 |
| `responseNote?` | string | |
| `good?`, `goodRole?` | string | ③ |
| `autoSummary` | `{ sessions: ModuleId[], approachAttemptIds: string[], worryNoteCount: number }` | 저장 시점의 자동 요약 |
| `tomorrowTask?` | string | 확장 버전 |

**assessments**

| 필드 | 타입 | 설명 |
|---|---|---|
| `instrument` | `"GAD7" \| "PHQ9"` | |
| `answers` | number[] (각 0~3) | GAD-7은 7개, PHQ-9는 9개 |
| `total` | number | 저장 시 계산 |
| `band` | string | 1단계 5장 구간 |
| `item9?` | 0~3 | PHQ-9만. 위기 판단에 직접 사용 |

**values**: `label`(가치 목록 값 또는 직접 입력), `why`(AF01 기본 버전 2번), `sentence`(3번), `belief`(0~10)

**recommendations**: `checkinId`, `primary: {module, variant, reason}`, `alternatives: […]`, `chosen: "primary"|"alt1"|"alt2"|"declined"|"other"`, `sessionId?`

**crisisEvents**: `trigger: "button"|"phq9item9"|"lowMood3Days"|"moduleStopSignal"`, `safeAnswer?: "safe"|"notSafe"|"skipped"`, `calledNumber?: "109"|"15770199"|"119"`(버튼을 누른 기록만, 통화 여부는 알 수 없음)

**settings** (한 행, 1단계 2장 "개인 설정이 바꾸는 경로")

```json
{
  "groundingFirst": false,
  "tippScreening": { "done": true, "restricted": false, "answeredAt": "2026-11-01T08:00:00+09:00" },
  "meditationAnchor": "breath",
  "md01Disabled": false,
  "worryTime": "21:30",
  "affirmationsEnabled": true,
  "dayBoundaryHour": 4,
  "textScale": 1.0,
  "theme": "system",
  "reducedMotion": "system"
}
```

**sessions.answers의 표준 키** — 모듈 간에 값을 넘기거나 주간 화면에서 집계하는 답은 키 이름을 고정합니다.

| 키 | 모듈 | 쓰는 곳 |
|---|---|---|
| `emotions` (`{word, intensity}[]`) | CB01 | CB02 3번 자동 불러오기 |
| `urgeAction` | CB01 5번 | 2장 추천의 판별 질문 4번 |
| `bodyParts` | CB01, AC03, MD01 | 주간 "자주 긴장하는 곳" |
| `thoughtId` | CB02, AC01 | `thoughts` |
| `beliefBefore`, `beliefAfter` | CB02 | 효과 지표 |
| `willingness` | AC03 | 효과 지표(불안 점수 대신) |
| `affirmationId`, `affirmationBelief`, `usedWeaker` | AF01 | 1단계 5장 확언 지표 |
| `noteLabels` | MD02 | 주간 "자주 찾아오는 생각의 종류" |
| `expectedPleasure`, `actualPleasure`, `expectedMastery`, `actualMastery` | CB05 | 예상 vs 실제 |

---

## 3. 상태 판별과 추천 로직

### 3.1 입출력

```ts
type RecommendInput = {
  checkin: Checkin;                 // 방금 한 체크인
  urgeAction?: UrgeAction;          // CB01을 막 했다면
  settings: Settings;
  now: Date;
  history: {                        // 최근 28일
    sessions: Session[];
    recommendations: Recommendation[];
    thoughts: Thought[];
  };
};

type Recommendation = {
  primary: Pick;                    // { module, variant, reason, sequenceId? }
  alternatives: [Pick, Pick];
  banner?: Banner;                  // 진정 기법 과다 사용 안내 등
  safety?: SafetyAction;            // 있으면 다른 모든 출력보다 먼저 표시
};
```

### 3.2 규칙 (의사코드)

```
function recommend(input):
  # 0. 안전 우선 (5장) — 항상 맨 먼저
  s = evaluateSafety(input)
  if s.blocking: return { safety: s }        # 위기 화면만 보여줌

  # 1. 상태 정하기 — 여러 개를 골랐다면 우선순위가 높은 하나
  #    D > A > C > B > E > F  (각성이 높고 급한 것 먼저)
  state = highestPriority(input.checkin.states)
  if input.checkin.anxiety >= 7 and state in [B, C, E, F]:
      state = A                              # 1단계 1.4 원칙 1: 7점 이상이면 몸 먼저
  if input.urgeAction:
      state = mapUrge(input.urgeAction)      # 피하기·숨기→C, 생각·확인→B, 화내기→D

  # 2. 상태별 후보 목록 (1단계 2장, 2단계 sequences.md)
  candidates = CANDIDATES[state]             # 순서 있는 목록, 3.3 표

  # 3. 개인 설정 적용
  if settings.groundingFirst: moveToFront(candidates, GR01); demote(candidates, [BR01, BR02])
  if settings.md01Disabled:   remove(candidates, MD01)
  if state == E and checkin.energy <= 2: remove(candidates, MD01); moveToFront(candidates, CB05)
  if settings.tippScreening.restricted: mark(DB01, variant="restricted")

  # 4. 피해야 할 조건 (Module.states.avoid)
  candidates = candidates.filter(m => not violatesAvoid(m, input))

  # 5. 반복 기록 감지 (1단계 5장 조정 규칙)
  if CB02 in candidates and recentThoughtRecordedTimes(history) >= 3:
      demote(candidates, CB02); moveToFront(candidates, AC01); addAfter(AC01, DB03)

  # 6. 반복 추천 방지
  for m in candidates:
      if declinedToday(m, history) >= 2: demote(candidates, m)
  if usedWithinMinutes(candidates[0], history, 30) and len(candidates) > 1:
      rotate(candidates)                     # 방금 한 모듈을 또 1순위로 내지 않음

  # 7. 개인화 (데이터 14일 이상일 때만, 3.4)
  if daysOfData(history) >= 14: applyPersonalization(candidates, state, history)

  # 8. 버전 고르기: 가용 시간 안에 들어가는 가장 긴 버전
  picks = take(candidates, 3).map(m => pickVariant(m, checkin.available))

  # 9. 이유 문장 (3.5)
  picks = picks.map(p => withReason(p, state, input))

  # 10. 진정 기법 과다 사용 안내 (1단계 5장)
  if calmingShare(history, days=14) >= 0.8:
      banner = CALMING_OVERUSE                # "다가가기도 함께 해볼까요?" + AC03 링크

  return { primary: picks[0], alternatives: [picks[1], picks[2]], banner }
```

### 3.3 상태별 후보 목록 (결정표)

| 상태 | 1순위 | 2순위 | 3순위 | 시퀀스 |
|---|---|---|---|---|
| A. 급성 불안 | BR01 | GR01 | DB01 | SEQ1 (GR01 → BR01 → CB01) |
| B. 걱정 루프 | DB02 | CB01 | AC01 / CB03 / CB02* | SEQ2 |
| C. 회피 직전 | AC03 (→ DB03) | DB03 | BR02 | SEQ3 (BR02 → AC03 → DB03) |
| D. 감정 폭주 | DB01 | DB02 | GR01 | SEQ4 (DB01 → DB02) |
| E. 무기력 | MD01 | CB05 | AF01 | SEQ5 (MD01 → AF01 → CB05) |
| F. 안정 | MD02 | MD01 | AF01(기본: 가치 쓰기) | — |

\* B의 3순위는 조건에 따라 고릅니다: 같은 걱정 메모가 오늘 이미 있음 → CB03 / 최근 CB02에서 다룬 생각과 같음 → AC01 / 그 밖에는 사용자가 판별 질문에서 "구체적인 예측"을 고르면 CB02, "답이 없는 반복"이면 AC01. MVP에서는 B 상태 체크인 화면에 "이 걱정은 어떤 쪽인가요? (확인 가능한 예측 / 답이 없는 '만약에')" 질문 1개를 추가로 둡니다.

"시퀀스로 하기" 버튼은 추천 화면 아래에 따로 둡니다. 1순위 하나만 하는 것이 기본입니다.

### 3.4 개인화 규칙 (14일 이후)

```
function applyPersonalization(candidates, state, history):
  stats = for each module m used in this state at least 3 times (최근 28일, completed만):
            meanDelta = mean(pre[main] - post[main])
  for m in candidates:
      if m.kind in [approach, activation]:   # 1단계 5장: 즉각 변화가 작을 수 있어 제외
          continue
      if stats[m].count >= 5 and stats[m].meanDelta < 1:
          demote(candidates, m)
      if stats[m].count >= 3 and stats[m].meanDelta >= 2:
          promote(candidates, m, maxRank=1)
  # 단, 상태 A·D의 1순위는 항상 calming 종류로 유지 (몸 먼저 원칙)
```

- 개인화는 **순서만 바꾸고 목록에서 빼지 않습니다**. 효과가 낮다고 판단된 모듈도 대안으로는 남습니다.
- 주 점수(`main`)는 모듈의 `postMeasure.id`입니다(불안, 충동, 긴장 등). AC03은 `willingness`, DB03은 다가간 일 수로 따로 봅니다.

### 3.5 추천 이유 문장

이유는 항상 **제안형**으로, 치료적 판단처럼 들리지 않게 씁니다.

| 상황 | 문장 |
|---|---|
| 불안 7점 이상 | "불안이 높을 때는 몸부터 진정시키는 게 도움이 될 수 있어요." |
| B 상태 | "걱정이 맴돌 때는 먼저 잠깐 멈추고, 지금 무슨 일이 일어나는지 보는 걸 해볼 수 있어요." |
| C 상태 | "불안이 있어도 한 걸음 다가가 볼 수 있어요. 아주 작은 걸음부터요." |
| 개인화로 올라옴 | "지난 몇 주 동안 이 연습을 했을 때 불안이 평균 {delta}점쯤 내려갔어요." |
| 그라운딩 먼저 설정 | "호흡보다 주변 감각에 집중하는 게 더 편하다고 하셨죠." |
| 반복 기록 감지 | "이 생각은 이미 여러 번 따져 보셨어요. 이번엔 거리를 두는 방법을 해볼 수 있어요." |

### 3.6 추천을 거절했을 때
- 대안 2개를 바로 보여줍니다. 대안도 거절하면 "직접 고르기"(전체 모듈 목록)와 "오늘은 그냥 두기" 버튼.
- "오늘은 그냥 두기"도 정상 선택으로 기록하고(`chosen: "declined"`), 아무 안내 없이 홈으로 돌아갑니다.
- 같은 모듈을 하루 2번 거절하면 그날은 1순위에서 내립니다(3.2의 6번).

---

## 4. 측정과 피드백 로직

### 4.1 척도 실시 주기

| 시점 | 동작 |
|---|---|
| 온보딩 | GAD-7, PHQ-9 (건너뛰기 가능, 다음 날 다시 제안) |
| 마지막 실시 후 14일 | 홈 화면에 "2주가 지났어요. 1~2분이면 돼요" 카드. 3일 동안 미루면 카드만 남기고 더 안내하지 않음 |
| 기분·에너지 4점 이하가 14일 이상 | PHQ-9 즉시 제안 (1단계 5장) |
| 언제든 | 설정 화면에서 직접 실시 |

**문항 문구**: GAD-7과 PHQ-9는 **표준화된 한국어판 문구를 그대로** 써야 합니다. 직접 번역하거나 다듬지 않습니다. 4단계에서 공식 한국어판(PHQ 스크리너 배포처)의 문구를 `content/assessments/`에 옮기고 출처를 함께 적습니다. 확보하기 전까지는 `TODO(content)`입니다.

### 4.2 점수 구간 안내 문구 (참고용)

| 척도 | 구간 | 문구 |
|---|---|---|
| GAD-7 | 0~4 | "지난 2주 동안 불안 증상이 거의 없었어요." |
| | 5~9 | "가벼운 불안 증상이 있었어요. 지금처럼 연습을 이어가 보세요." |
| | 10~14 | "중간 정도의 불안 증상이 있었어요. 이 앱과 함께 전문가에게 한 번 평가를 받아 보면 도움이 될 수 있어요." + 연락처 |
| | 15~21 | "불안 증상이 심한 편이었어요. 전문가의 도움을 받아 보길 권해요." + 연락처(강조) |
| PHQ-9 | 0~4 / 5~9 / 10~14 / 15~19 / 20~27 | 같은 형식. 10점 이상부터 전문가 안내, 15점 이상 강조 |

모든 결과 화면 하단: "이 점수는 진단이 아니에요. 지난 2주를 돌아보는 참고 자료예요."

### 4.3 주간 화면 지표 (월요일~일요일, 하루 경계 새벽 4시)

| 지표 | 계산 | 표시 |
|---|---|---|
| 연습한 날 | `sessions(completed)`가 1개 이상인 날 수 | "이번 주 연습한 날 5일" (연속 기록은 표시하지 않음) |
| 불안 추이 | 날마다 저녁 기록 `anxiety`, 없으면 그날 체크인 평균 | 7일 막대 + 지난주 평균과 비교 |
| 하루 대표 기분 | 저녁 기록 `mood`, 없으면 그날 체크인 중 최저 | 7일 막대 |
| 다가간 일 | `approachAttempts` 중 `done`·`stoppedMidway` 수 | "이번 주 다가간 일 3번" + 목록 |
| 피한 일 | 저녁 기록 ②에 `avoided`가 있는 날 수 | 다가간 일과 나란히 |
| 모듈별 효과 | 이번 주 `completed` 세션의 평균 `pre - post` (3회 미만은 "아직 적어요") | 상위 3개 |
| 예상 vs 실제 | DB03 `predictionCameTrue` 분포, CB05 예상·실제 차이 | "걱정했던 일이 그대로 일어난 건 3번 중 0번" |
| 걱정 시간 | 걱정 메모 중 걱정 시간에 "지금은 괜찮아요"로 표시한 비율 | |
| 자주 오는 것 | MD02 이름표, AC01 이야기 제목, 긴장 부위 상위 1개씩 | |

### 4.4 조정 규칙의 구현 (1단계 5장)

| 규칙 | 판정 시점 | 동작 |
|---|---|---|
| 모듈 5회 이상, 평균 변화 1점 미만 | 추천할 때 (3.4) | 순서 내림 (approach·activation 제외) |
| 2주간 다가간 일 0~1개 | 주간 화면을 열 때 | "다가가기 사다리의 첫 단계를 더 작게 나눠 볼까요?" 카드 → DB03 사다리 편집 |
| 진정 모듈 80% 이상 (14일) | 추천할 때 | 배너 (3.2의 10번) |
| CB02 같은 생각 3회 이상 | 추천할 때 | 3.2의 5번 |
| GAD-7 2회 연속 감소 없음 | 척도 저장 시 | 주간 화면에 "5단계 점검을 해볼 때예요" 카드. 4주(척도 3회) 변화 없으면 전문가 안내 |
| 기분·에너지 4점 이하 14일 | 매일 첫 실행 시 | PHQ-9 제안, 루틴에 E 경로 추가 제안 |

모든 판정 함수는 `now`와 기록을 인자로 받는 순수 함수로 만들어 테스트합니다(7.3).

---

## 5. 안전 로직 (가장 엄격하게)

### 5.1 원칙
1. **안전 로직은 다른 모든 로직보다 먼저 실행되고, 다른 로직이 막을 수 없습니다.** 추천, 개인화, 화면 흐름 어디에서도 위기 화면을 건너뛰거나 늦추는 코드를 두지 않습니다.
2. **위기 화면은 앱에 내장된 정적 화면입니다.** 네트워크, 데이터베이스, 콘텐츠 파일 로딩에 의존하지 않습니다. 데이터베이스가 깨져도 열려야 합니다.
3. **위기 버튼은 모든 화면에 항상 있습니다.** 온보딩, 모듈 진행 중, 척도 응답 중, 설정 화면을 포함합니다.
4. **자동 텍스트 분석을 하지 않습니다**(1단계 6.2). 판단 근거는 사용자가 직접 고른 값(PHQ-9 9번, 점수, 위기 버튼)뿐입니다.

### 5.2 감지 조건과 동작

| 트리거 | 조건 | 동작 | 막는 것 |
|---|---|---|---|
| 위기 버튼 | 누름 | 위기 화면 즉시 | 진행 중이던 모듈은 일시정지(저장) |
| PHQ-9 9번 | `item9 >= 1` | 결과 화면 **전에** 위기 확인 화면: "지금 안전한가요?" | 결과 화면은 확인 화면 이후에만 |
| ↳ "안전하지 않아요" | | 위기 화면(전화 버튼 강조) | 명상·저널링 추천 숨김 |
| ↳ "지금은 안전해요" | | 결과 화면 + 연락처 상단 고정 + "이런 생각이 들 때 연락할 수 있는 곳" | — |
| 하루 대표 기분 | 2점 이하가 3일 연속 | 다음 실행 시 확인 카드: "요즘 많이 힘드셨던 것 같아요" + 연락처 | 하루 한 번만 표시 |
| 기분 0~2 입력 | JR01·CB05·체크인 | 그 화면에서 위기 버튼 강조(색, 크기) | — |
| 모듈 멈춤 신호 | `stopSignals[].action == "crisis"` 선택 | 위기 화면 | — |

### 5.3 위기 화면 내용

```
지금 많이 힘드시군요. 혼자 견디지 않아도 괜찮아요.

[ 109 자살예방상담전화 · 24시간 ]      ← tel:109
[ 1577-0199 정신건강위기상담 · 24시간 ]  ← tel:15770199
[ 119 응급 상황 ]                    ← tel:119

지금 바로 할 수 있는 것
· 혼자 있지 않기, 믿을 수 있는 사람에게 연락하기
· 위험한 물건에서 멀어지기
· 이 화면을 닫지 않고 전화하기

[ 돌아가기 ]  (작게, 화면 맨 아래)
```

- 전화 버튼은 `tel:` 링크입니다. 전화가 안 되는 기기(PC)에서도 번호가 크게 보이도록 버튼 안에 번호를 글자로 적습니다.
- 위기 화면에서는 모듈 추천, 확언, 명상 링크를 보여주지 않습니다.
- 위기 화면이 열린 기록은 `crisisEvents`에 남기되, 열린 이유 외의 내용은 저장하지 않습니다. 이 기록은 5단계 점검의 안전 점검 항목에서 씁니다.

### 5.4 구현 방법
- `src/safety/` 폴더에 모든 판정 함수와 위기 화면을 모읍니다. 다른 폴더는 `src/safety/`를 불러 쓸 수 있지만, `src/safety/`는 순수 로직(`src/domain/`) 외의 기능 폴더를 불러오지 않습니다(의존 방향 고정).
- `evaluateSafety(state) → SafetyAction | null`은 순수 함수입니다. 체크인·저녁 기록·척도·모듈 종료를 저장할 때마다, 그리고 앱을 열 때마다 호출합니다.
- 위기 화면 컴포넌트와 연락처 문자열은 코드에 직접 들어갑니다(콘텐츠 JSON에서 읽지 않음). 서비스 워커의 사전 캐시 목록에 반드시 포함합니다.
- 4단계 테스트: PHQ-9 9번 0/1/2/3 각각, 기분 2점 3일 연속과 2일 연속, 하루 경계(새벽 4시) 전후, 데이터베이스 열기 실패 시 위기 버튼 동작, 오프라인 상태에서 위기 화면 열기.

---

## 6. 개인정보와 데이터 보호

### 6.1 저장
- 모든 기록은 브라우저의 IndexedDB에만 저장합니다. 서버도, 계정도, 동기화도 없습니다.
- 앱은 **어떤 외부 요청도 보내지 않습니다**: 분석 도구, 오류 리포트, 외부 글꼴, 외부 CDN 없음. 모든 파일을 앱과 함께 배포합니다. 4단계에서 "빌드 결과물에 외부 주소가 없는지" 검사하는 테스트를 둡니다.
- 페이지에 `Content-Security-Policy`(`default-src 'self'; connect-src 'self'`)를 넣어 실수로라도 외부로 요청하지 못하게 합니다.

### 6.2 암호화와 잠금에 대한 판단
- **MVP는 앱 자체 암호화를 하지 않습니다.** 브라우저 저장소는 기기 잠금과 기기 암호화(최신 휴대폰은 기본으로 켜져 있음)로 보호됩니다. 앱 자체 암호화는 비밀번호를 잊으면 기록을 영원히 잃는 위험이 있고, 구현 실수가 생기기 쉽습니다.
- **기기를 다른 사람과 같이 쓴다면 이 판단이 달라집니다.** 그 경우 2차에서 "앱 잠금 + 비밀번호 기반 암호화(Web Crypto, PBKDF2 또는 Argon2 + AES-GCM)"를 함께 구현합니다. 암호화 없는 PIN 잠금만 두면 실제로는 보호가 되지 않으므로, 잠금만 따로 넣지 않습니다.
- 브라우저의 "저장 공간 유지 요청"(`navigator.storage.persist()`)을 온보딩에서 요청해, 브라우저가 공간 부족 시 기록을 지우지 않게 합니다.

### 6.3 내보내기·가져오기·삭제
| 기능 | 내용 |
|---|---|
| 전체 백업 내보내기 | 모든 테이블을 JSON 한 파일로(`meditation-backup-YYYYMMDD.json`, `schemaVersion` 포함). 파일을 저장한 곳의 보안은 사용자 책임임을 안내 |
| 표 내보내기 | 체크인·세션·저녁 기록·척도를 CSV로. 5단계 점검에 그대로 쓸 수 있음. 저널 글(자유 입력)을 뺀 "점수만" 옵션 제공 |
| 가져오기 | 백업 JSON만. `schemaVersion` 확인, 현재 기록에 **합치기**(같은 `id`는 덮어쓰지 않음) 또는 **바꾸기**(전체 교체, 두 번 확인) |
| 전체 삭제 | 두 번 확인("삭제" 입력). IndexedDB 삭제 + 서비스 워커 캐시는 유지(앱은 계속 쓸 수 있음) |
| 백업 알림 | 마지막 백업 후 30일이 지나면 설정 화면에 표시(홈 화면에는 띄우지 않음) |

### 6.4 공개 서비스로 바꿀 경우 (참고, 법률 자문 아님)
지금은 혼자 쓰므로 해당하지 않습니다. 다른 사람에게 배포하거나 서버에 기록을 모은다면, 건강에 관한 정보는 개인정보보호법상 **민감정보**에 해당해 별도 동의, 안전성 확보 조치 등 더 엄격한 의무가 생깁니다. 그때는 전문가 자문을 받고 설계를 다시 해야 합니다.

### 6.5 외부로 보내지 않는 것
MVP는 외부로 아무것도 보내지 않습니다. 나중에 AI API 등을 붙이더라도 아래는 **절대 보내지 않습니다**: 저널 글, 걱정 메모, 생각 기록, 척도 응답, 위기 기록. 보낼 수 있는 것은 사용자가 그 자리에서 직접 확인한 익명 통계뿐입니다(예: "이번 주 평균 불안 5.2").

---

## 7. 화면 흐름과 아키텍처

### 7.1 화면 목록

| 화면 | 경로 | 내용 |
|---|---|---|
| 온보딩 | `/welcome` | 이 앱이 무엇이고 무엇이 아닌지(보조 도구) → 위기 연락처 안내 → GAD-7·PHQ-9(건너뛰기 가능) → 걱정 시간 정하기(나중에 가능) → 저장 공간 유지 요청 |
| 홈 | `/` | 오늘 카드, 빠른 시작, "지금 어때요?" 버튼, 걱정 메모 버튼 |
| 체크인 | `/checkin` | 점수 3개 → 상태 → 가용 시간 (B면 질문 1개 추가) |
| 추천 | `/recommend` | 1순위 큰 카드 + 대안 2개 + "시퀀스로 하기" + "직접 고르기" |
| 모듈 진행 | `/m/:id/:variant` | 시작 전 점수 → 단계 → 종료 점수 → 마무리 → 다음 연결 |
| 걱정 메모 | `/worry/new` | 한 줄 입력, 저장 즉시 홈으로 |
| 저녁 | `/evening` | 걱정 시간(메모가 있으면) → JR01 |
| 주간 | `/week` | 4.3 지표 |
| 척도 | `/assess/:instrument` | GAD-7 / PHQ-9 |
| 모듈 목록 | `/modules` | 상태별로 묶은 전체 모듈, 근거 수준 표시 |
| 다가가기 | `/approach` | 다가가고 싶은 일과 사다리, 예정된 시도 |
| 설정 | `/settings` | 개인 설정, 글자 크기, 테마, 데이터(내보내기·가져오기·삭제), 앱 정보·참고문헌 |
| 위기 | `/crisis` | 5.3 |

### 7.2 주요 흐름 (텍스트 와이어프레임)

**홈**
```
┌──────────────────────────────────┐
│ 11월 2일 일요일          [위기] │  ← 모든 화면 오른쪽 위 고정
│                                  │
│ ┌──────────────────────────────┐ │
│ │      지금 어때요?            │ │  ← 체크인 → 추천
│ └──────────────────────────────┘ │
│                                  │
│ 바로 시작                        │  ← 1번 탭으로 모듈 시작
│ [한숨 3번 · 30초] [그라운딩 · 1분] [STOP · 1분] │
│                                  │
│ [ + 걱정 메모 ]                   │  ← 1번 탭으로 입력창
│                                  │
│ 오늘                             │
│ · 아침 루틴 ○   · 저녁 기록 ○    │
│ · 다가갈 일: 회의에서 한마디 하기 │
│ · 오늘의 확언: "나는 불안과 함께…" │
│                                  │
│ [홈] [모듈] [다가가기] [주간] [설정] │
└──────────────────────────────────┘
```

**2번 탭 원칙(컨디션 최악인 날 기준)**: 앱 열기 → "바로 시작" 카드 1번 탭 → 모듈의 시작 전 점수 화면. 시작 전 점수는 "건너뛰기"를 눌러도 됩니다(기록에는 `pre` 없음). 바로 시작 카드 3개는 기본으로 BR01·GR01·DB02 최소 버전이고, `groundingFirst`면 GR01이 맨 앞, 14일 이후에는 가장 효과가 좋았던 최소 버전 3개로 바뀝니다.

**일반 흐름**
```
홈 ─"지금 어때요?"→ 체크인(점수·상태·시간) → 추천 ─1순위→ 모듈 진행 → 마무리 → 다음 연결(선택) → 홈
                                          └ 대안/직접 고르기/그냥 두기
                     (안전 트리거) ───────────────────────────────────→ 위기 화면
```

**모듈 진행 화면**
```
┌──────────────────────────────────┐
│ ← 멈추기     BR02 느린 호흡  [위기] │
│                                  │
│            ( 원 애니메이션 )          │
│                                  │
│    원이 커지면 코로 들이쉬세요.        │
│                                  │
│ [힘들어요]               ●●○○○○  │  ← "힘들어요" = E. 문제가 생길 때 목록
└──────────────────────────────────┘
```
- "← 멈추기": 진행 상황 저장(`status: "stopped"`) 후 "멈춰도 괜찮아요" 화면 → 홈.
- "힘들어요": 그 모듈의 troubleshooting과 stopSignals 목록. 고르면 안내 → 대체 모듈 링크.

**저녁 흐름**: 홈의 "저녁 기록" → (오늘 걱정 메모가 있고 걱정 시간 설정됨) 걱정 시간 → JR01 → 마무리 문장 → (선택) BR02 확장 버전.

**아침 흐름**: 홈의 "아침 루틴" → 체크인(source: morning) → BR02 최소 → AF01 최소(확언 켜짐 시) → "오늘 다가갈 작은 일"(어제 JR01 확장의 `tomorrowTask`, 다가가기 사다리의 다음 단계, CB03 "할 수 있는 일" 중 제안).

### 7.3 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어 | TypeScript | 콘텐츠·기록의 형식을 타입으로 검사 |
| 빌드 | Vite | 설정이 단순하고 빠름 |
| UI | React 18 | 자료와 예제가 가장 많음 |
| 라우팅 | React Router (HashRouter, 주소가 `/#/checkin` 형태) | GitHub Pages는 하위 경로 새로고침 시 404가 나므로, 서버 설정 없이 동작하는 해시 주소를 씀 |
| 저장소 | Dexie (IndexedDB 래퍼) | 버전별 스키마 이전(migration) 지원 |
| PWA | vite-plugin-pwa (Workbox) | 서비스 워커 사전 캐시, 설치 |
| 스타일 | 일반 CSS + CSS 변수(디자인 토큰) | 외부 라이브러리 없이 다크 모드·글자 크기 조절 |
| 테스트 | Vitest(로직), Testing Library(컴포넌트), Playwright(주요 흐름, 오프라인) | 이 환경에 Playwright와 Chromium이 이미 설치되어 있음 |
| 콘텐츠 검증 | zod | 앱 시작 시와 테스트에서 `content/` JSON 형식 검사 |
| 배포 | GitHub Pages (정적 파일) | 무료, HTTPS 기본 제공(PWA 설치에 필요) |

### 7.4 폴더 구조

```
/
├── content/                  콘텐츠 (코드와 분리, 1장)
│   ├── modules/BR01.json …   모듈 16개
│   ├── affirmations.json
│   ├── sequences.json
│   ├── lexicon/              emotions.json, activities.json, values.json, patterns.json, noteLabels.json
│   ├── assessments/          gad7.json, phq9.json (공식 한국어판 문구, TODO(content))
│   └── references.json
├── src/
│   ├── safety/               위기 판정, 위기 화면, 위기 버튼 (다른 기능 폴더에 의존하지 않음)
│   ├── domain/               순수 로직: recommend, personalization, metrics, adjustRules, conditions(조건식), dayBoundary
│   ├── db/                   Dexie 스키마, 이전(migration), 저장소 함수, 내보내기·가져오기
│   ├── content/              콘텐츠 로딩과 zod 검증
│   ├── player/               모듈 진행 엔진 (Step 종류별 컴포넌트, pacer, timer)
│   ├── screens/              홈, 체크인, 추천, 저녁, 주간, 척도, 설정, 온보딩, 다가가기
│   ├── ui/                   공용 컴포넌트 (Scale, ChoiceButtons, BodyMap 등), 디자인 토큰
│   └── main.tsx
├── tests/
│   ├── domain/               추천·측정·조정 규칙 단위 테스트
│   ├── safety/               안전 로직 테스트 (5.4)
│   ├── content/              콘텐츠 형식과 2단계 문서 일치 검사
│   └── e2e/                  Playwright: 2번 탭 흐름, 오프라인 위기 화면, 내보내기·가져오기
├── docs/                     1~3단계 문서
└── prompts/
```

**의존 방향**: `screens → player, domain, db, content, safety`, `player → domain, content, safety`, `domain → (없음)`, `safety → domain`(날짜 계산과 타입만). `domain`과 `safety`의 판정 함수는 React와 Dexie를 모르는 순수 TypeScript라서 단독으로 테스트할 수 있습니다. 위기 화면 컴포넌트는 `db`에 의존하지 않습니다(위기 기록 저장은 화면 바깥의 버튼 처리에서 하고, 실패해도 화면은 열림).

### 7.5 오프라인과 시간
- 서비스 워커가 앱 파일과 `content/` 전체를 사전 캐시합니다. 첫 방문 후에는 비행기 모드에서도 모든 기능이 동작해야 합니다.
- **타이머는 시작 시각 기준으로 계산합니다.** 남은 시간 = 목표 종료 시각 - 현재 시각. 화면이 꺼지거나 앱이 백그라운드로 갔다 와도 어긋나지 않고, 그사이 지나간 단계는 건너뜁니다.
- 모듈 진행 중에는 지원되는 브라우저에서 화면 꺼짐 방지(Screen Wake Lock)를 요청하고, 안 되면 조용히 넘어갑니다.
- 애니메이션은 `prefers-reduced-motion`을 따릅니다. 줄인 움직임 설정에서는 원 대신 숫자와 막대로 호흡 속도를 보여줍니다.

### 7.6 알림 원칙 (2차)
MVP에는 알림이 없습니다. 2차에서 추가할 때의 원칙:
- 하루 최대 2개(아침 루틴, 걱정 시간), 사용자가 켠 것만.
- 문구는 초대형: "준비되면 1분 숨 고르기 해볼까요?" ("오늘 아직 안 하셨어요" 같은 표현 금지).
- 3일 연속 알림을 무시하면 빈도를 줄일지 한 번 묻고, 그 뒤로는 묻지 않음.
- 알림 내용에 기록 내용(걱정, 점수)을 넣지 않음(잠금 화면 노출 방지).

### 7.7 접근성
- 기본 글자 크기 18px, 설정에서 1.0~1.6배.
- 터치 영역 최소 48×48px, 0~10 슬라이더는 숫자 버튼 11개로도 고를 수 있게.
- 다크 모드(시스템 따라가기 기본). 밤에 쓰는 일이 많으므로 다크 모드의 밝기를 낮게.
- 화면 낭독기: 원 애니메이션에 "들이쉬기 4초" 같은 상태 문구를 `aria-live`로 제공.
- 색만으로 정보를 전달하지 않음(위기 버튼은 글자와 아이콘 함께).

---

## 8. 4단계 구현 계획

### 8.1 작업 목록

| # | 작업 | 내용 | 완료 기준 |
|---|---|---|---|
| 0 | 프로젝트 초기 설정 | Vite + React + TS, 린트·포맷, Vitest, Playwright, vite-plugin-pwa, 폴더 구조(7.4), GitHub Actions(테스트), CSP | `npm run dev`로 빈 홈 화면, `npm test` 통과, 빌드 결과에 외부 주소 없음 |
| 1 | 안전 기반 | `src/safety/`: 위기 화면, 상시 위기 버튼(레이아웃), `evaluateSafety` + 테스트(5.4) | 모든 화면에서 위기 버튼 동작, 오프라인 e2e 통과, 안전 테스트 전부 통과 |
| 2 | 저장소 | Dexie 스키마(2장), 하루 경계 함수, 저장소 함수, 스키마 버전 | 각 테이블 저장·조회 테스트, 새벽 4시 경계 테스트 |
| 3 | 콘텐츠 형식과 로딩 | zod 스키마(1.3), 조건식 해석기(1.5), BR01·GR01·DB02 JSON | 형식 검사 테스트, 조건식 테스트, 2단계 문서와 ID·단계 수 일치 테스트 |
| 4 | 모듈 진행 엔진 | Step 종류별 컴포넌트, pacer, timer(시각 기준), 전후 점수, 멈추기, "힘들어요" | BR01·GR01·DB02 최소·기본 버전을 끝까지 진행하고 세션이 저장됨 |
| 5 | 홈과 빠른 시작 | 홈 화면, 바로 시작 카드, 2번 탭 원칙 | e2e: 앱 열기 → 2번 탭 안에 모듈 시작 |
| 6 | 체크인과 추천 | 체크인 화면, `recommend`(3장) + 결정표 테스트, 추천 화면, 거절 처리 | 상태 A~F, 7점 규칙, 개인 설정, 반복 방지 테스트 통과 |
| 7 | 나머지 모듈 콘텐츠 | 13개 모듈 JSON 변환(BR02, CB01, AC01, CB03, CB02, AC03, DB03, DB01, MD01, MD02, CB05, AF01, JR01), 감정 단어·활동·가치 목록 | 16개 모듈 모두 형식 검사·일치 테스트 통과, 각 모듈 e2e 1회 |
| 8 | 모듈 간 연결 데이터 | 걱정 메모·걱정 시간, 생각 목록(반복 감지), 다가가기 사다리·시도, 내 가치, 확언 믿는 정도, DB01 안전 확인 | 2.3 표준 키로 모듈 간 값이 넘어감, "다가간 일" 자동 기록 |
| 9 | 저녁과 아침 흐름 | 7.2의 저녁·아침 흐름, JR01 자동 요약 | e2e: 하루 시나리오(2단계 `sequences.md`의 하루 일정) 통과 |
| 10 | 척도 | GAD-7·PHQ-9 화면(공식 한국어판 문구 확보), 구간 안내, 주기 카드, PHQ-9 9번 연동 | 9번 응답별 안전 흐름 테스트, 문구 출처 기록 |
| 11 | 주간 화면과 조정 규칙 | 4.3 지표, 4.4 규칙 | 지표 계산 테스트(가짜 데이터 28일분) |
| 12 | 설정과 데이터 | 개인 설정, 글자 크기, 테마, 내보내기(JSON/CSV)·가져오기·전체 삭제, 저장 공간 유지 요청 | 내보내기 → 삭제 → 가져오기 후 데이터 동일 |
| 13 | 온보딩 | 7.1 온보딩 흐름 | 처음 실행 e2e |
| 14 | 시퀀스 | 시퀀스 1~5 실행 | 각 시퀀스 e2e |
| 15 | 배포와 MVP 점검 | GitHub Pages 배포, 휴대폰 설치 확인, 1단계 7.2 체크리스트, 안전 시나리오 수동 점검, 2주 사용 점검표 | 4단계 프롬프트의 "모든 작업이 끝난 뒤" 항목 완료 |

작업 0~6을 마치면 **처음으로 직접 써 볼 수 있는 앱**(체크인 → 추천 → 모듈 3개)이 됩니다. 작업 7 이후는 모듈과 기능을 채워 가는 단계입니다.

### 8.2 핵심 테스트 시나리오

**안전 (작업 1, 10)**
1. 모듈 진행 중 위기 버튼 → 위기 화면, 세션은 `stopped`로 저장
2. PHQ-9 9번 = 0 → 결과 화면 바로 / 1·2·3 → 확인 화면 먼저, "안전하지 않아요" → 위기 화면, 추천 숨김
3. 하루 대표 기분 2,2,2(3일) → 확인 카드 / 2,2,3 → 없음 / 새벽 3시 기록은 전날로 계산
4. 오프라인(서비스 워커 캐시만)에서 위기 화면 열기
5. IndexedDB 열기 실패를 흉내 냈을 때도 위기 버튼과 위기 화면 동작
6. 빌드 결과물에 외부 주소(http로 시작하는 외부 도메인)가 없음

**추천 (작업 6, 8, 11)**
7. 불안 8 + 상태 B → A 경로(BR01 1순위)
8. 상태 C와 B를 함께 고름 → C 우선
9. `groundingFirst` → A의 1순위 GR01
10. E + 에너지 2 → MD01 없음, CB05 1순위
11. CB02로 같은 생각 3회 → AC01 1순위, DB03 뒤따름
12. 같은 모듈 2회 거절 → 그날 1순위 아님
13. 14일 미만 → 개인화 없음 / 14일 이상, 효과 큰 모듈 → 1순위로 오르되 A·D에서는 calming만 1순위
14. 진정 모듈 80% 이상 → 배너
15. 가용 시간 60초 → 최소 버전만

**흐름 (작업 5, 9, 14)**
16. 앱 열기 → 2번 탭 안에 모듈 시작
17. 화면을 끄고 1분 뒤 다시 켬 → 타이머가 실제 경과 시간만큼 진행
18. DB03 완료 → 저녁 기록에 "다가간 일" 자동 표시, 주간 지표에 반영

### 8.3 4단계에서 쓸 프롬프트 주제
- `prompts/04-implementation.md`를 작업 0부터 15까지 하나씩 실행합니다. 각 작업의 `[이번 작업]` 칸에 8.1 표의 이름과 완료 기준을 그대로 넣습니다.

---

## 나중에 (MVP 범위 밖)
- 앱 잠금 + 암호화(6.2), 알림(7.6), 음성 가이드, 노출 사다리 진행 그래프
- 글 유사도로 반복 생각 자동 감지(MVP는 사용자 선택)
- 2차 모듈(MD03, CB04, AC02, DB04, DB05, JR02, 문제 해결)
- 여러 기기 동기화(서버가 필요하므로 6.4의 검토가 먼저)

## 이전 단계 수정 제안

> 아래 5개는 이 문서를 작성하면서 함께 반영했습니다(`docs/01-framework.md` 2·3·5장과 7.3, `docs/02-modules/README.md`).

1. **척도 문구 출처 (1단계 5장)**: 1단계는 "두 척도 모두 공개적으로 쓸 수 있고 한국어판이 표준화되어 있다"고만 적었습니다. 직접 번역하면 안 되고 공식 한국어판 문구를 그대로 써야 한다는 점, 출처를 앱에 표시한다는 점을 1단계 5장에 추가하는 것을 제안합니다.
2. **B 상태의 생각 종류 질문 (1단계 2장)**: 3.3에서 B 상태 체크인에 "확인 가능한 예측 / 답이 없는 '만약에'" 질문 1개를 추가했습니다. 1단계 2장 판별 질문에도 B를 골랐을 때의 추가 질문으로 넣는 것을 제안합니다.
3. **하루의 경계 (1단계 3장·5장)**: 저녁 기록을 자정 넘어 쓰는 경우를 위해 하루의 경계를 새벽 4시로 정했습니다(2.1). 1단계 3장 루틴과 6.2의 "3일 연속" 판정에 같은 기준을 명시하는 것을 제안합니다.
4. **시작 전 점수 건너뛰기 (2단계 모든 모듈 B)**: 2번 탭 원칙을 지키려면 빠른 시작에서 시작 전 점수를 건너뛸 수 있어야 합니다. 2단계 공통 규칙(`docs/02-modules/README.md`)에 "시작 전 점수는 건너뛸 수 있고, 건너뛴 세션은 효과 계산에서 빠진다"를 추가하는 것을 제안합니다.
5. **앱 잠금 (1단계 7.3)**: 1단계는 "앱 잠금(PIN)"을 2차 항목으로 두었습니다. 암호화 없는 잠금은 실제 보호가 되지 않으므로 "앱 잠금 + 암호화"로 묶어 적는 것을 제안합니다(6.2).
