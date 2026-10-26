import { describe, expect, it } from 'vitest';
import { evaluate, isValidExpression } from '../../src/domain/conditions';

const scope = { pre: { anxiety: 8 }, post: { anxiety: 5 }, setting: { groundingFirst: true }, answer: { kind: 'avoid' } };

describe('조건식 (설계 1.5)', () => {
  it('비교', () => {
    expect(evaluate('post.anxiety>=4', scope)).toBe(true);
    expect(evaluate('post.anxiety>=7', scope)).toBe(false);
    expect(evaluate('pre.anxiety > post.anxiety', scope)).toBe(true);
  });
  it('논리 연산과 괄호', () => {
    expect(evaluate('setting.groundingFirst && post.anxiety < 6', scope)).toBe(true);
    expect(evaluate('!(setting.groundingFirst) || false', scope)).toBe(false);
  });
  it('문자열과 in', () => {
    expect(evaluate("answer.kind == 'avoid'", scope)).toBe(true);
    expect(evaluate("answer.kind in ['hide', 'avoid']", scope)).toBe(true);
  });
  it('값이 없으면 크기 비교는 거짓 (시작 전 점수를 건너뛴 경우)', () => {
    expect(evaluate('pre.urge>=7', scope)).toBe(false);
    expect(evaluate('true', {})).toBe(true);
  });
  it('정해진 문법 밖은 거부한다', () => {
    expect(isValidExpression('alert(1)')).toBe(false);
    expect(isValidExpression('post.anxiety >=')).toBe(false);
    expect(isValidExpression('a; b')).toBe(false);
  });
});
