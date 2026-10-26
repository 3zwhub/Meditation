// 위기 연락처는 콘텐츠 파일이 아니라 코드에 직접 둔다 (설계 5.4). 파일 로딩이 실패해도 보여야 하기 때문이다.
export const CRISIS_CONTACTS = [
  { number: '109', tel: '109', label: '자살예방상담전화', hours: '24시간' },
  { number: '1577-0199', tel: '15770199', label: '정신건강위기상담', hours: '24시간' },
  { number: '119', tel: '119', label: '응급 상황', hours: '' },
] as const;
