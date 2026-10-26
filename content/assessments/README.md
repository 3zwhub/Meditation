# GAD-7·PHQ-9 문항 넣기

이 두 척도는 **공식 한국어판 문구를 글자 그대로** 써야 합니다(설계 4.1). 직접 번역하거나 다듬은 문항으로는 점수를 믿을 수 없습니다.
그래서 지금은 `items`, `options`, `instruction`, `source`가 비어 있고, 앱은 "문항 준비 중"을 보여줍니다.

## 채우는 방법

1. PHQ Screeners 공식 배포처(phqscreeners.com, "Select screener" → Korean for Korea)에서 PHQ-9와 GAD-7 한국어판을 받습니다.
2. `gad7.json`, `phq9.json`에 아래 네 항목을 채웁니다. 띄어쓰기와 문장부호까지 원문 그대로 옮깁니다.

```json
"source": { "title": "PHQ-9 Korean for Korea (Pfizer, PHQ Screeners)", "url": "받은 주소", "retrievedAt": "받은 날짜(YYYY-MM-DD)" },
"instruction": "원문 지시문",
"options": ["0점 선택지", "1점 선택지", "2점 선택지", "3점 선택지"],
"items": ["1번 문항", "2번 문항", "..."]
```

3. `TODO` 줄을 지웁니다.
4. `npm test`를 돌립니다. 문항 수가 맞지 않거나 출처가 비어 있으면 테스트가 알려 줍니다.

PHQ-9의 9번(죽음이나 자해에 대한 생각)은 위기 확인과 연결되어 있으므로, 순서를 바꾸지 않습니다(`safetyItem: 9`).
