import { afterEach, describe, expect, it, vi } from 'vitest';
import { storeService } from '#plugins/kace/services/storeService.js';
import {
  getHandshakeParams,
  withHandshakeEvaluatorContext,
} from './withHandshakeEvaluatorContext.js';

describe('withHandshakeEvaluatorContext', () => {
  afterEach(() => {
    storeService.set('auth.handshake_params', null);
    storeService.set('auth.auth_cognito_response', null);
  });

  it('injects params and authCognitoResponse when missing from context', () => {
    storeService.set('auth.handshake_params', {
      case_id: 'c-1',
      user_id: 'u-1',
    });
    storeService.set('auth.auth_cognito_response', { user: { id: 'u-1' } });

    const ctx = withHandshakeEvaluatorContext({ data: { foo: 1 } });

    expect(ctx.data).toEqual({ foo: 1 });
    expect(ctx.params).toEqual({ case_id: 'c-1', user_id: 'u-1' });
    expect(ctx.authCognitoResponse).toEqual({ user: { id: 'u-1' } });
  });

  it('does not override explicit params or authCognitoResponse', () => {
    storeService.set('auth.handshake_params', { case_id: 'stored' });

    const ctx = withHandshakeEvaluatorContext({
      params: { case_id: 'explicit' },
      authCognitoResponse: { from: 'script' },
    });

    expect(ctx.params).toEqual({ case_id: 'explicit' });
    expect(ctx.authCognitoResponse).toEqual({ from: 'script' });
  });

  it('getHandshakeParams returns null when not set', () => {
    expect(getHandshakeParams()).toBeNull();
  });
});
