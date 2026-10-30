import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storeService } from '#plugins/kace/services/storeService.js';
import { resolveEventLogContext } from './resolveEventLogContext.js';

describe('resolveEventLogContext', () => {
  beforeEach(() => {
    storeService.set('auth.handshake_params', null);
    storeService.set('cases.case_id', null);
    vi.stubGlobal('window', {
      location: { href: 'https://example.com/form' },
    });
  });

  afterEach(() => {
    storeService.set('auth.handshake_params', null);
    storeService.set('cases.case_id', null);
    vi.unstubAllGlobals();
  });

  it('resolves entity_id and primary_entity from handshake (board aux)', () => {
    storeService.set('auth.handshake_params', {
      entity_id: 'aux-123',
      primary_entity: 'aux_clientes',
    });

    expect(resolveEventLogContext()).toEqual({
      entityId: 'aux-123',
      primaryEntity: 'aux_clientes',
    });
  });

  it('resolves case_id from handshake with primaryEntity cases (admin case)', () => {
    storeService.set('auth.handshake_params', {
      case_id: 'case-456',
    });

    expect(resolveEventLogContext()).toEqual({
      entityId: 'case-456',
      primaryEntity: 'cases',
    });
  });

  it('contextCaseId takes precedence and forces primaryEntity cases (subcase)', () => {
    storeService.set('auth.handshake_params', {
      entity_id: 'aux-123',
      primary_entity: 'aux_clientes',
      case_id: 'case-456',
    });

    expect(resolveEventLogContext({ contextCaseId: 'subcase-789' })).toEqual({
      entityId: 'subcase-789',
      primaryEntity: 'cases',
    });
  });

  it('falls back to URL params when handshake is empty', () => {
    vi.stubGlobal('window', {
      location: {
        href: 'https://example.com/form?entity_id=url-entity&primary_entity=aux_url',
      },
    });

    expect(resolveEventLogContext()).toEqual({
      entityId: 'url-entity',
      primaryEntity: 'aux_url',
    });
  });

  it('falls back to cases.case_id in store when handshake has no case_id', () => {
    storeService.set('cases.case_id', 'stored-case-999');

    expect(resolveEventLogContext()).toEqual({
      entityId: 'stored-case-999',
      primaryEntity: 'cases',
    });
  });

  it('returns null values when no source provides context', () => {
    expect(resolveEventLogContext()).toEqual({
      entityId: null,
      primaryEntity: null,
    });
  });
});
