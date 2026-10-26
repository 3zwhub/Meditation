# 1단계 수정 제안 (2단계 작성 중 발견)

`docs/01-framework.md`에 반영할지 검토가 필요한 항목입니다. 반영하면 이 목록에서 지웁니다.

## 1회차에서 발견

1. **BR01 근거 표현 조정**
   1단계 1.2 메커니즘 지도와 4장 모듈 표는 BR01을 "빠른 각성 낮추기"로 적었습니다. 그런데 Balban et al.(2023)은 하루 5분씩 한 달간 연습한 효과를 본 연구이고, 한두 번의 한숨으로 즉시 진정되는 효과를 검증한 것은 아닙니다. → 4장 BR01의 목적을 "긴장을 낮추는 호흡 연습(즉시 효과는 예비 근거)"으로 고치는 것을 제안합니다.

2. **GR01과 STOP의 근거 수준 표기**
   1.2 지도에서 그라운딩(GR01)과 DBT STOP(DB02)은 별도 근거 수준 없이 다른 기법과 묶여 있습니다. 둘 다 임상에서 널리 쓰이지만 단독 검증 연구가 거의 없으므로 "예비"로 따로 표기하는 것을 제안합니다.

3. **참고문헌 추가**
   CB01 근거로 Kircanski, Lieberman & Craske (2012). Feelings into words: Contributions of language to exposure therapy. *Psychological Science*. 를 참고문헌에 추가할 것을 제안합니다(앱 인용 전 원문 확인).

4. **0~10 점수 기준 통일**
   1단계 5장은 0~10 점수를 쓰지만 각 점수가 무엇을 뜻하는지 정하지 않았습니다. 2단계 `README.md`에 정한 기준(0 전혀 없음 / 3 약간 / 5 집중 어려움 / 7 다른 것 하기 어려움 / 10 가장 강함)을 1단계 5장에도 넣고, 2장 라우팅의 "7점 이상" 같은 기준과 연결하는 것을 제안합니다.

5. **"호흡보다 그라운딩 먼저" 개인 설정**
   1단계 6.4는 공황 경향이 있을 때 GR01을 첫 개입으로 하라고 했지만 이를 어떻게 정할지는 없습니다. BR01·BR02의 E(문제가 생길 때)에 "호흡에 집중하니 더 불안하다"를 고르면 이후 A 상태의 첫 추천을 GR01로 바꾸는 **개인 설정**을 두는 것을 제안합니다(3단계 추천 로직에 반영).

6. **CB01의 "감정이 시키는 행동"을 라우팅 입력으로**
   CB01 기본 버전 5번(이 감정이 시키는 행동)의 답이 다음 모듈 선택에 매우 유용합니다. 1단계 2장 판별 질문에 이 항목을 추가하거나, 3단계 추천 로직에서 CB01 결과를 다음 추천의 입력으로 쓰는 것을 제안합니다.

## 2회차에서 발견

7. **참고문헌 추가 (2회차)**
   - Levin, M. E. et al. (2012). The impact of treatment components suggested by the psychological flexibility model: A meta-analysis of laboratory-based component studies. *Behavior Therapy*. (AC01)
   - Masuda, A. et al. (2004). Cognitive defusion and self-relevant negative thoughts: Examining the impact of a ninety year old technique. *Behaviour Research and Therapy*. (AC01)
   - McGowan, S. K., & Behar, E. (2013). A preliminary investigation of stimulus control training for worry: Effects on anxiety and insomnia. *Behavior Modification*. (CB03)
   - Eifert, G. H., & Heffner, M. (2003). The effects of acceptance versus control contexts on avoidance of panic-related symptoms. *Journal of Behavior Therapy and Experimental Psychiatry*. (AC03)
   - Campbell-Sills, L. et al. (2006). Effects of suppression and acceptance on emotional responses of individuals with anxiety and mood disorders. *Behaviour Research and Therapy*. (AC03)
   모두 앱 인용 전 원문 확인이 필요합니다.

8. **DB03에 행동실험 요소가 들어감 → CB04와 역할 정리**
   DB03 기본 버전에 "예상 적기 → 실행 → 실제 결과 비교"를 넣었습니다(억제 학습 원리). 이는 2차로 미룬 CB04 행동실험의 핵심과 같습니다. → 1단계 4장에서 CB04를 "DB03의 확장(여러 번 반복하는 계획된 실험, 예상 확신도 추적)"으로 재정의하거나, CB04를 DB03에 합치는 것을 제안합니다. 또한 7.3의 "단계적 노출 사다리"도 DB03 3번(다가가기 사다리)에서 이미 시작되므로, 사다리 저장·진행 추적만 2차로 남기면 됩니다.

9. **AC03 → DB03을 하나의 흐름으로**
   AC03은 단독으로 끝나지 않고 항상 DB03으로 이어지게 설계했습니다(진정·수용이 안전행동이 되지 않게). → 1단계 2장 C 상태의 경로를 "AC03 → DB03 (한 흐름)"으로 명시하고, 3단계 화면 설계에서 두 모듈을 "다가가기" 하나의 흐름으로 묶는 것을 제안합니다.

10. **"다가간 일"을 자동 기록으로**
    1단계 5장은 "다가간 일/피한 일"을 저녁 3줄 기록에서 체크한다고 했습니다. DB03 완료(첫걸음 "했어요" 포함, 중간에 멈춘 시도 포함)를 **자동으로 "다가간 일"로 기록**하고, JR01에서는 확인·추가만 하게 하는 것을 제안합니다. 저녁 기록 부담이 줄고 지표가 더 정확해집니다.

11. **CB02의 "같은 예측 반복 기록" 감지**
    같은 걱정을 매일 사고기록하는 것은 안심 구하기(안전행동)가 될 수 있습니다. → 3단계 추천 로직에 "비슷한 자동적 생각을 3회 이상 기록하면 CB02 대신 AC01 또는 DB03 추천" 규칙을 넣는 것을 제안합니다. (MVP에서는 사용자가 "이전에 기록한 생각" 목록에서 같은 것을 고르는 방식으로 단순하게 판별)

12. **CB03의 화면 진입점과 알림**
    걱정 메모는 걱정이 올 때 몇 초 안에 열려야 의미가 있습니다. → 1단계 7.2 MVP의 "2번 탭 안에 시작" 원칙에 걱정 메모를 포함하고(홈 화면 고정 버튼), 걱정 시간은 알림이 없는 MVP에서는 "저녁 3줄 기록 직전에 자동으로 이어지는" 방식으로 정하는 것을 제안합니다.

13. **불안이 사실에 맞는 경우의 경로**
    DB03의 사실 확인에서 "불안이 사실에 맞음"(실제 위험)으로 나온 경우, 1단계에는 이어질 모듈이 없습니다. MVP에서는 CB02의 대처 칸으로 연결했지만, 2차에 **문제 해결 모듈**(DBT 문제 해결 또는 CBT 문제 해결 훈련)을 추가하는 것을 제안합니다.
