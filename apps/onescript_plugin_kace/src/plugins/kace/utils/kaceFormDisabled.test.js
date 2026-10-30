import { describe, expect, it } from 'vitest';
import {
  CASE_EDIT_LOCKED_STORE_KEY,
  resolveKaceDisabledClassName,
} from './kaceFormDisabled.js';

describe('CASE_EDIT_LOCKED_STORE_KEY', () => {
  it('is the Auth case-edit lock store key', () => {
    expect(CASE_EDIT_LOCKED_STORE_KEY).toBe('cases.case_edit_locked');
  });
});

describe('resolveKaceDisabledClassName', () => {
  it('returns empty string when not disabled', () => {
    expect(
      resolveKaceDisabledClassName({ disabled: false, readOnlyLock: false })
    ).toBe('');
  });

  it('returns empty string when disabled due to case edit lock', () => {
    expect(
      resolveKaceDisabledClassName({ disabled: true, readOnlyLock: true })
    ).toBe('');
  });

  it('returns disabled class for generic Form.io disabled', () => {
    expect(
      resolveKaceDisabledClassName({ disabled: true, readOnlyLock: false })
    ).toBe('kace-component--disabled');
  });
});
