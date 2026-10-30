import { describe, expect, it } from 'vitest';
import { isKaceSelectScrollNearBottom } from './kaceSelectScrollNearBottom.js';

describe('isKaceSelectScrollNearBottom', () => {
  it('returns false when there is no overflow', () => {
    const el = {
      scrollHeight: 100,
      clientHeight: 100,
      scrollTop: 0,
    };
    expect(isKaceSelectScrollNearBottom(el)).toBe(false);
  });

  it('returns false when overflow exists but not near bottom', () => {
    const el = {
      scrollHeight: 400,
      clientHeight: 100,
      scrollTop: 0,
    };
    expect(isKaceSelectScrollNearBottom(el)).toBe(false);
  });

  it('returns true when scrolled within threshold of bottom', () => {
    const el = {
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 380,
    };
    expect(isKaceSelectScrollNearBottom(el)).toBe(true);
  });
});
