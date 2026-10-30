import { describe, expect, it, vi } from 'vitest';
import { CASE_TRANSITION_STALE } from '@kace/error-codes';
import { applySaveOutcomeToSnapshot } from './applySaveOutcomeToSnapshot.js';

describe('applySaveOutcomeToSnapshot', () => {
  it('keeps rejected CAS fields at the snapshot value after save', () => {
    const store = {
      get: vi.fn(() => ({
        case: { transicion_id: 't-load', responsable_id: 'r-load' },
        aux_cases: { id: 'aux-1', data: {} },
        description: 'loaded',
      })),
      set: vi.fn(),
    };

    applySaveOutcomeToSnapshot(
      store,
      {
        case: { transicion_id: 't-form', responsable_id: 'r-form' },
        aux_cases: { id: 'aux-1', data: {} },
        description: 'loaded',
      },
      {
        data: {
          data: {
            warnings: [{ code: CASE_TRANSITION_STALE, message: 'stale' }],
          },
        },
      }
    );

    expect(store.set).toHaveBeenCalledWith(
      'cases.edit_snapshot',
      expect.objectContaining({
        case: expect.objectContaining({
          transicion_id: 't-load',
          responsable_id: 'r-form',
        }),
      })
    );
  });
});
