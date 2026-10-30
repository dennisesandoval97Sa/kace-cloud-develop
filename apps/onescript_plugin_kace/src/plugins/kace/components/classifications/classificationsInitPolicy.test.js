import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumePendingDefaults,
  createInitSession,
  isClassificationsAuthReady,
  markScriptRan,
  queueOrResolveDefaults,
  shouldEvaluateUserScript,
} from './classificationsInitPolicy.js';

describe('classificationsInitPolicy', () => {
  const tree = [{ value: 'A', label: 'A' }];
  const validateSelection = vi.fn((t, selection) => ({ ...selection }));
  const readyCreateCtx = {
    caseContextResolved: true,
    isEditCase: false,
    authReady: true,
    code: 'setDefaultSelections({ nivel1: "A" })',
  };

  beforeEach(() => {
    validateSelection.mockClear();
    validateSelection.mockImplementation((t, selection) => ({ ...selection }));
  });

  describe('isClassificationsAuthReady', () => {
    it('returns true when config.kace_auth_ready is true', () => {
      const read = (path) =>
        path === 'config.kace_auth_ready' ? true : undefined;
      expect(isClassificationsAuthReady(read)).toBe(true);
    });

    it('returns true when user.user_data is already hydrated', () => {
      const read = (path) =>
        path === 'user.user_data'
          ? { groups: [{ id: 'g1', nombre: 'COL DIAMANTES' }] }
          : undefined;
      expect(isClassificationsAuthReady(read)).toBe(true);
    });

    it('returns true when auth.user_data is hydrated', () => {
      const read = (path) =>
        path === 'auth.user_data' ? { groups: [] } : undefined;
      expect(isClassificationsAuthReady(read)).toBe(true);
    });

    it('returns false when auth has not finished', () => {
      const read = () => undefined;
      expect(isClassificationsAuthReady(read)).toBe(false);
    });
  });

  describe('shouldEvaluateUserScript', () => {
    it('returns false when case context is not resolved', () => {
      expect(
        shouldEvaluateUserScript(createInitSession(), {
          ...readyCreateCtx,
          caseContextResolved: false,
        })
      ).toBe(false);
    });

    it('returns false when editing a case', () => {
      expect(
        shouldEvaluateUserScript(createInitSession(), {
          ...readyCreateCtx,
          isEditCase: true,
        })
      ).toBe(false);
    });

    it('returns false when auth is not ready yet', () => {
      expect(
        shouldEvaluateUserScript(createInitSession(), {
          ...readyCreateCtx,
          authReady: false,
        })
      ).toBe(false);
    });

    it('returns false when code is empty or whitespace', () => {
      const session = createInitSession();
      expect(
        shouldEvaluateUserScript(session, {
          ...readyCreateCtx,
          code: '',
        })
      ).toBe(false);
      expect(
        shouldEvaluateUserScript(session, {
          ...readyCreateCtx,
          code: '   ',
        })
      ).toBe(false);
      expect(
        shouldEvaluateUserScript(session, {
          ...readyCreateCtx,
          code: null,
        })
      ).toBe(false);
    });

    it('waits for auth then runs once (case ready before kaceAuthData)', () => {
      let session = createInitSession();
      const beforeAuth = {
        caseContextResolved: true,
        isEditCase: false,
        authReady: false,
        code: readyCreateCtx.code,
      };
      expect(shouldEvaluateUserScript(session, beforeAuth)).toBe(false);

      const afterAuth = { ...beforeAuth, authReady: true };
      expect(shouldEvaluateUserScript(session, afterAuth)).toBe(true);
      session = markScriptRan(session);
      expect(shouldEvaluateUserScript(session, afterAuth)).toBe(false);
    });

    it('returns true once for create, then false after markScriptRan', () => {
      let session = createInitSession();
      expect(shouldEvaluateUserScript(session, readyCreateCtx)).toBe(true);
      session = markScriptRan(session);
      expect(shouldEvaluateUserScript(session, readyCreateCtx)).toBe(false);
    });
  });

  describe('queueOrResolveDefaults', () => {
    it('queues selection when tree is empty', () => {
      const session = createInitSession();
      const result = queueOrResolveDefaults(
        session,
        { nivel1: 'A' },
        [],
        validateSelection
      );
      expect(result.kind).toBe('queue');
      expect(result.session.pendingDefaults).toEqual({ nivel1: 'A' });
      expect(validateSelection).not.toHaveBeenCalled();
    });

    it('applies validated selection when tree is ready', () => {
      const session = createInitSession();
      validateSelection.mockReturnValue({ nivel1: 'A' });
      const result = queueOrResolveDefaults(
        session,
        { nivel1: 'A', nivel2: 'missing' },
        tree,
        validateSelection
      );
      expect(result.kind).toBe('apply');
      expect(result.validated).toEqual({ nivel1: 'A' });
      expect(result.session.pendingDefaults).toBeNull();
      expect(validateSelection).toHaveBeenCalledWith(tree, {
        nivel1: 'A',
        nivel2: 'missing',
      });
    });

    it('returns noop for invalid selection', () => {
      const session = createInitSession();
      expect(
        queueOrResolveDefaults(session, null, tree, validateSelection).kind
      ).toBe('noop');
    });
  });

  describe('consumePendingDefaults', () => {
    it('applies and clears pending when tree arrives', () => {
      let session = createInitSession();
      session = queueOrResolveDefaults(
        session,
        { nivel1: 'A' },
        [],
        validateSelection
      ).session;
      validateSelection.mockReturnValue({ nivel1: 'A' });
      const result = consumePendingDefaults(session, tree, validateSelection);
      expect(result.kind).toBe('apply');
      expect(result.validated).toEqual({ nivel1: 'A' });
      expect(result.session.pendingDefaults).toBeNull();
    });

    it('returns noop when there is no pending', () => {
      const result = consumePendingDefaults(
        createInitSession(),
        tree,
        validateSelection
      );
      expect(result.kind).toBe('noop');
      expect(validateSelection).not.toHaveBeenCalled();
    });

    it('does not require script re-evaluation after scriptRan', () => {
      let session = markScriptRan(createInitSession());
      session = queueOrResolveDefaults(
        session,
        { nivel1: 'A' },
        [],
        validateSelection
      ).session;
      expect(
        shouldEvaluateUserScript(session, {
          caseContextResolved: true,
          isEditCase: false,
          authReady: true,
          code: 'console.log(1)',
        })
      ).toBe(false);
      const result = consumePendingDefaults(session, tree, validateSelection);
      expect(result.kind).toBe('apply');
      expect(
        shouldEvaluateUserScript(result.session, {
          caseContextResolved: true,
          isEditCase: false,
          authReady: true,
          code: 'console.log(1)',
        })
      ).toBe(false);
    });

    it('preserves pendingDefaults across markScriptRan (queue then load)', () => {
      let session = createInitSession();
      session = queueOrResolveDefaults(
        session,
        { nivel1: 'UNO' },
        [],
        validateSelection
      ).session;
      session = markScriptRan(session);
      expect(session.scriptRan).toBe(true);
      expect(session.pendingDefaults).toEqual({ nivel1: 'UNO' });
      validateSelection.mockReturnValue({ nivel1: 'UNO' });
      const result = consumePendingDefaults(
        session,
        [{ value: 'UNO', label: 'UNO' }],
        validateSelection
      );
      expect(result.kind).toBe('apply');
      expect(result.validated).toEqual({ nivel1: 'UNO' });
    });
  });
});
