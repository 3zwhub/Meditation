// 콘텐츠의 if/when 조건식 해석기 (설계 1.5).
// 임의의 코드를 실행하지 않고, 정해진 변수·연산자만 해석한다.
// 문법: or := and ('||' and)* ; and := unary ('&&' unary)* ; unary := '!' unary | cmp
//       cmp := value (op value | 'in' list)? ; value := number | string | true | false | path | '(' or ')'

export type Scope = Record<string, unknown>;

type Token = { t: 'num' | 'str' | 'id' | 'op'; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const two = src.slice(i, i + 2);
    if (['>=', '<=', '==', '!=', '&&', '||'].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('<>!()[],'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: 'num', v: src.slice(i, j) }); i = j; continue;
    }
    if (c === '"' || c === "'") {
      const j = src.indexOf(c, i + 1);
      if (j < 0) throw new Error(`닫히지 않은 문자열: ${src}`);
      out.push({ t: 'str', v: src.slice(i + 1, j) }); i = j + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) }); i = j; continue;
    }
    throw new Error(`알 수 없는 문자 '${c}': ${src}`);
  }
  return out;
}

function lookup(scope: Scope, path: string): unknown {
  let cur: unknown = scope;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function evaluate(expr: string, scope: Scope): boolean {
  const toks = tokenize(expr);
  let pos = 0;
  const peek = () => toks[pos];
  const eat = (v?: string) => {
    const tok = toks[pos];
    if (!tok || (v !== undefined && tok.v !== v)) throw new Error(`'${v ?? '값'}'이 필요합니다: ${expr}`);
    pos++;
    return tok;
  };

  function value(): unknown {
    const tok = eat();
    if (tok.t === 'num') return Number(tok.v);
    if (tok.t === 'str') return tok.v;
    if (tok.t === 'op' && tok.v === '(') { const v = or(); eat(')'); return v; }
    if (tok.t === 'id') {
      if (tok.v === 'true') return true;
      if (tok.v === 'false') return false;
      return lookup(scope, tok.v);
    }
    throw new Error(`예상하지 못한 '${tok.v}': ${expr}`);
  }

  function list(): unknown[] {
    eat('[');
    const items: unknown[] = [];
    while (peek() && peek().v !== ']') {
      items.push(value());
      if (peek()?.v === ',') eat(',');
    }
    eat(']');
    return items;
  }

  function cmp(): unknown {
    const left = value();
    const tok = peek();
    if (!tok) return left;
    if (tok.t === 'id' && tok.v === 'in') { eat(); return list().includes(left); }
    if (tok.t !== 'op' || !['>=', '<=', '==', '!=', '<', '>'].includes(tok.v)) return left;
    eat();
    const right = value();
    switch (tok.v) {
      case '==': return left === right;
      case '!=': return left !== right;
    }
    // 값이 없으면(예: 시작 전 점수를 건너뜀) 크기 비교는 거짓
    if (typeof left !== 'number' || typeof right !== 'number') return false;
    switch (tok.v) {
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '<': return left < right;
      default: return left > right;
    }
  }

  function unary(): unknown {
    if (peek()?.v === '!') { eat(); return !unary(); }
    return cmp();
  }

  function and(): unknown {
    let v = unary();
    while (peek()?.v === '&&') { eat(); const r = unary(); v = Boolean(v) && Boolean(r); }
    return v;
  }

  function or(): unknown {
    let v = and();
    while (peek()?.v === '||') { eat(); const r = and(); v = Boolean(v) || Boolean(r); }
    return v;
  }

  const result = or();
  if (pos !== toks.length) throw new Error(`해석하지 못한 부분이 남았습니다: ${expr}`);
  return Boolean(result);
}

/** 문법만 검사한다 (콘텐츠 테스트용). */
export function isValidExpression(expr: string): boolean {
  try {
    evaluate(expr, {});
    return true;
  } catch {
    return false;
  }
}
