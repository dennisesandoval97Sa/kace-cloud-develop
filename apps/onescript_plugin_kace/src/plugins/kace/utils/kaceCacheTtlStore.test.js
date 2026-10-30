import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readTtl,
  writeTtl,
  clearTtl,
  readSignature,
} from './kaceCacheTtlStore.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('kaceCacheTtlStore', () => {
  it('writeTtl persists ttl and signature; readTtl returns the ttl', () => {
    writeTtl(300_000, 'sig-abc');
    expect(readTtl()).toBe(300_000);
  });

  it('readSignature returns the persisted signature', () => {
    writeTtl(300_000, 'sig-abc');
    expect(readSignature()).toBe('sig-abc');
  });

  it('readTtl returns null when nothing is persisted', () => {
    expect(readTtl()).toBeNull();
  });

  it('readSignature returns null when nothing is persisted', () => {
    expect(readSignature()).toBeNull();
  });

  it('clearTtl removes the persisted entry', () => {
    writeTtl(300_000, 'sig-abc');
    clearTtl();
    expect(readTtl()).toBeNull();
    expect(readSignature()).toBeNull();
  });

  it('writeTtl overwrites previous entry', () => {
    writeTtl(300_000, 'sig-abc');
    writeTtl(600_000, 'sig-def');
    expect(readTtl()).toBe(600_000);
    expect(readSignature()).toBe('sig-def');
  });

  it('survives a kace_engine_data removal (isolated key)', () => {
    localStorage.setItem('kace_engine_data', '{"config":{}}');
    writeTtl(300_000, 'sig-abc');
    localStorage.removeItem('kace_engine_data');
    expect(readTtl()).toBe(300_000);
    expect(readSignature()).toBe('sig-abc');
  });

  it('returns null on corrupted JSON', () => {
    localStorage.setItem('kace_cache_ttl_ms', 'not-json');
    expect(readTtl()).toBeNull();
    expect(readSignature()).toBeNull();
  });
});
