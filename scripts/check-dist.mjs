// 설계 6.1: 빌드 결과물이 외부 주소로 요청을 보내지 않는지 검사한다.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = [
  'http://www.w3.org/', // SVG·XML 네임스페이스 (요청이 아님)
  'https://reactrouter.com/', // React Router 오류 메시지 안의 문서 링크 (요청이 아님)
  'https://react.dev/', // React 오류 메시지 안의 문서 링크 (요청이 아님)
  'https://reactjs.org/',
  'https://github.com/', // 라이브러리 오류 메시지 안의 링크 (요청이 아님)
];

// 앞부분이 아니라 정확히 같은 문자열만 허용한다. 모두 라이브러리 안의 상수이며 요청을 보내지 않는다.
const ALLOWED_EXACT = [
  'http://localhost', // React Router가 상대 URL을 해석할 때 쓰는 기준값
  'http://[${e}]', // React Router의 IPv6 주소 처리 템플릿
  'https://json-schema.org/draft/2020-12/schema', // zod의 JSON 스키마 식별자
  'http://json-schema.org/draft-07/schema#',
  'http://json-schema.org/draft-04/schema#',
  'https://tinyurl.com/y2uuvskb', // Dexie 오류 메시지 안의 문서 링크
  'http://bit.ly/2kdckMn', // Dexie 오류 메시지 안의 문서 링크
  'https://bit.ly/wb-precache', // Workbox 오류 메시지 안의 문서 링크
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const offenders = [];
for (const file of walk('dist')) {
  if (!/\.(html|js|css|json|webmanifest)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) {
    if (!ALLOWED.some((a) => m[0].startsWith(a)) && !ALLOWED_EXACT.includes(m[0])) offenders.push(`${file}: ${m[0]}`);
  }
}

if (offenders.length) {
  console.error('빌드 결과물에 외부 주소가 있습니다:\n' + offenders.join('\n'));
  process.exit(1);
}
console.log('check-dist: 외부 주소 없음');
