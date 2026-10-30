import { describe, expect, it } from 'vitest';
import { configSignature } from './configSignature.js';

describe('configSignature', () => {
  it('returns a stable string for the same object regardless of key order', () => {
    const a = { x: 1, y: { b: 2, a: 1 } };
    const b = { y: { a: 1, b: 2 }, x: 1 };
    expect(configSignature(a)).toBe(configSignature(b));
  });

  it('returns different strings for different values', () => {
    expect(configSignature({ ttl: 300 })).not.toBe(
      configSignature({ ttl: 600 })
    );
  });

  it('returns a stable string for null', () => {
    expect(configSignature(null)).toBe(configSignature(null));
  });

  it('returns different strings for null vs undefined', () => {
    expect(configSignature(null)).not.toBe(configSignature(undefined));
  });
});
