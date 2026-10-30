import { describe, expect, it } from 'vitest';
import { makeLoadCacheKey } from './kaceScriptSelectLoadKey.js';

describe('makeLoadCacheKey', () => {
  it('differs when page changes', () => {
    const a = makeLoadCacheKey({
      componentKey: 'f1',
      page: 1,
      remoteTerm: '',
      dependencySignature: 'x',
    });
    const b = makeLoadCacheKey({
      componentKey: 'f1',
      page: 2,
      remoteTerm: '',
      dependencySignature: 'x',
    });
    expect(a).not.toBe(b);
  });

  it('differs when remoteTerm changes', () => {
    const a = makeLoadCacheKey({
      componentKey: 'f1',
      page: 1,
      remoteTerm: 'foo',
      dependencySignature: 'x',
    });
    const b = makeLoadCacheKey({
      componentKey: 'f1',
      page: 1,
      remoteTerm: 'bar',
      dependencySignature: 'x',
    });
    expect(a).not.toBe(b);
  });

  it('is stable for same inputs', () => {
    const params = {
      componentKey: 'f1',
      page: 1,
      remoteTerm: 'q',
      dependencySignature: '{"a":1}',
    };
    expect(makeLoadCacheKey(params)).toBe(makeLoadCacheKey(params));
  });
});
