import { describe, expect, it } from 'vitest';
import {
  CASE_RECLASSIFY_CASE_CLOSED,
  CASE_RECLASSIFY_CLASSIFICATION_INACTIVE,
  CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP,
  CASE_RECLASSIFY_CLASSIFICATION_STALE,
  CASE_RECLASSIFY_CLASSIFICATION_WITHOUT_FORM,
  CASE_RECLASSIFY_DISABLED,
  CASE_RECLASSIFY_PARENT_UNVERIFIABLE,
  CASE_RECLASSIFY_REASON_REQUIRED,
  CASE_RECLASSIFY_SUBCASE_NOT_ALLOWED,
  CASE_RECLASSIFY_TRANSITION_OUT_OF_FLOW,
  CASE_RECLASSIFY_TRANSITION_REQUIRED,
} from '@kace/error-codes';
import { reclassificationErrorMessage } from './reclassificationErrorMessage.js';

describe('reclassificationErrorMessage', () => {
  it('translates the classification-not-in-group blocker by its code', () => {
    expect(
      reclassificationErrorMessage({
        code: CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP,
        message:
          'The target classification is not available for the case group.',
      })
    ).toBe(
      'La clasificación seleccionada no está disponible para el grupo del caso.'
    );
  });

  it.each([
    CASE_RECLASSIFY_CASE_CLOSED,
    CASE_RECLASSIFY_CLASSIFICATION_INACTIVE,
    CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP,
    CASE_RECLASSIFY_SUBCASE_NOT_ALLOWED,
    CASE_RECLASSIFY_TRANSITION_OUT_OF_FLOW,
    CASE_RECLASSIFY_CLASSIFICATION_WITHOUT_FORM,
    CASE_RECLASSIFY_CLASSIFICATION_STALE,
    CASE_RECLASSIFY_PARENT_UNVERIFIABLE,
    CASE_RECLASSIFY_DISABLED,
    CASE_RECLASSIFY_REASON_REQUIRED,
    CASE_RECLASSIFY_TRANSITION_REQUIRED,
  ])('has a Spanish message for %s', (code) => {
    expect(reclassificationErrorMessage({ code, message: 'english' })).not.toBe(
      'english'
    );
  });

  it('keeps the backend message when the code is not a reclassification one', () => {
    expect(
      reclassificationErrorMessage({ code: '0x050001', message: 'Bad request' })
    ).toBe('Bad request');
  });

  it('returns undefined without a blocker', () => {
    expect(reclassificationErrorMessage(null)).toBeUndefined();
  });
});
