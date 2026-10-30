import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CASE_TRANSITION_STALE as CATALOG_TRANSITION_STALE,
  CASE_RESPONSIBLE_STALE as CATALOG_RESPONSIBLE_STALE,
  CASE_CLIENT_STALE as CATALOG_CLIENT_STALE,
  CASE_CLASSIFICATION_STALE as CATALOG_CLASSIFICATION_STALE,
  CASE_GROUP_STALE as CATALOG_GROUP_STALE,
} from '@kace/error-codes';
import {
  CaseService,
  TRANSITION_STALE_WARNING,
  RESPONSIBLE_STALE_WARNING,
  CLIENTE_STALE_WARNING,
  CLASSIFICATION_STALE_WARNING,
  GROUP_STALE_WARNING,
  CASE_TRANSITION_STALE,
  CASE_RESPONSIBLE_STALE,
  CASE_CLIENT_STALE,
  CASE_CLASSIFICATION_STALE,
  CASE_GROUP_STALE,
} from './caseService.js';
import { extractStaleCodes } from '../utils/applySaveOutcomeToSnapshot.js';
import { removeKeysFromSubmissionData } from '../utils/removeKeysFromSubmissionData.js';
import { storeService } from './storeService.js';

// Mock module-level storeService used by BaseService
vi.mock('./storeService.js', () => ({
  storeService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Mock utilities that have side-effects or are not relevant to these tests
vi.mock('../utils/removeKeysFromSubmissionData.js', () => ({
  removeKeysFromSubmissionData: vi.fn(),
}));

vi.mock('../utils/getIgnoreSchemaKeysFromComponent.js', () => ({
  DEFAULT_IGNORE_SCHEMA_KEYS: [],
  STORE_KEY_IGNORE_SCHEMA_KEYS: 'config.ignore_schema_keys',
}));

vi.mock('#plugins/kace/utils/kaceResponseCache.js', () => ({
  invalidateKaceResponseCacheForCases: vi.fn(),
}));

vi.mock('#plugins/kace/utils/hydrateEditCaseToStore.js', () => ({
  hydrateEditCaseToStore: vi.fn(),
}));

// ─── TRANSITION_STALE_WARNING ───────────────────────────────────────────────

describe('stale catalog codes', () => {
  it('re-exports stale codes from @kace/error-codes', () => {
    expect(CASE_TRANSITION_STALE).toBe(CATALOG_TRANSITION_STALE);
    expect(CASE_RESPONSIBLE_STALE).toBe(CATALOG_RESPONSIBLE_STALE);
    expect(CASE_CLIENT_STALE).toBe(CATALOG_CLIENT_STALE);
    expect(CASE_CLASSIFICATION_STALE).toBe(CATALOG_CLASSIFICATION_STALE);
    expect(CASE_GROUP_STALE).toBe(CATALOG_GROUP_STALE);
  });
});

describe('TRANSITION_STALE_WARNING', () => {
  it('is a non-empty string', () => {
    expect(typeof TRANSITION_STALE_WARNING).toBe('string');
    expect(TRANSITION_STALE_WARNING.length).toBeGreaterThan(0);
  });

  it('is written in Spanish', () => {
    // Contains at least one Spanish word that would not appear in English
    expect(TRANSITION_STALE_WARNING).toMatch(/guardaron|actualizado|edición/);
  });
});

describe('extractStaleCodes', () => {
  it('reads codes from envelope response.data.data.warnings', () => {
    expect(
      extractStaleCodes({
        data: {
          data: {
            warnings: [
              {
                code: '0x030041',
                message:
                  'Field was not updated because it changed after the form was loaded',
              },
            ],
          },
        },
      })
    ).toEqual(['0x030041']);
  });

  it('ignores transition_stale and top-level errors', () => {
    expect(
      extractStaleCodes({
        data: {
          data: { transition_stale: true },
          errors: [{ code: '0x030041' }],
        },
      })
    ).toEqual([]);
  });

  it('returns [] when warnings is missing', () => {
    expect(extractStaleCodes({ data: { data: { id: '789' } } })).toEqual([]);
  });

  it('keeps only known stale codes in listed order', () => {
    expect(
      extractStaleCodes({
        data: {
          data: {
            warnings: [
              { code: CASE_TRANSITION_STALE },
              { code: '0x030003' },
              { code: CASE_RESPONSIBLE_STALE },
              { code: CASE_CLIENT_STALE },
              { code: CASE_CLASSIFICATION_STALE },
              { code: CASE_GROUP_STALE },
            ],
          },
        },
      })
    ).toEqual([
      CASE_TRANSITION_STALE,
      CASE_RESPONSIBLE_STALE,
      CASE_CLIENT_STALE,
      CASE_CLASSIFICATION_STALE,
      CASE_GROUP_STALE,
    ]);
  });

  it('includes CASE_CLIENT_STALE when present among known stale warnings', () => {
    expect(
      extractStaleCodes({
        data: {
          data: {
            warnings: [{ code: CASE_CLIENT_STALE }, { code: '0x030099' }],
          },
        },
      })
    ).toEqual([CASE_CLIENT_STALE]);
  });
});

describe('RESPONSIBLE_STALE_WARNING', () => {
  it('is a non-empty Spanish string', () => {
    expect(typeof RESPONSIBLE_STALE_WARNING).toBe('string');
    expect(RESPONSIBLE_STALE_WARNING.length).toBeGreaterThan(0);
    expect(RESPONSIBLE_STALE_WARNING).toMatch(/responsable|guardaron|edición/);
  });
});

describe('CLIENTE_STALE_WARNING', () => {
  it('matches the verbatim Spanish toast copy', () => {
    expect(CLIENTE_STALE_WARNING).toBe(
      'El cliente del caso fue actualizado automáticamente durante la edición. Se guardaron los demás cambios, pero el cliente no fue modificado.'
    );
  });
});

describe('CLASSIFICATION_STALE_WARNING', () => {
  it('matches the verbatim Spanish toast copy', () => {
    expect(CLASSIFICATION_STALE_WARNING).toBe(
      'La clasificación del caso fue actualizada automáticamente durante la edición. Se guardaron los demás cambios, pero la clasificación no fue modificada.'
    );
  });
});

describe('GROUP_STALE_WARNING', () => {
  it('matches the verbatim Spanish toast copy', () => {
    expect(GROUP_STALE_WARNING).toBe(
      'El grupo del caso fue actualizado automáticamente durante la edición. Se guardaron los demás cambios, pero el grupo no fue modificado.'
    );
  });
});

describe('CaseService.handleErrorMessage', () => {
  const service = new CaseService({ apiService: {}, store: {} });
  const httpError = (errors, data) => ({
    response: { data: { errors, data } },
  });

  it('translates a reclassification blocker by its public code', () => {
    expect(
      service.handleErrorMessage(
        httpError([
          {
            code: '0x030058',
            message:
              'The target classification is not available for the case group.',
          },
        ])
      )
    ).toBe(
      'La clasificación seleccionada no está disponible para el grupo del caso.'
    );
  });

  it('keeps translating the known backend texts', () => {
    expect(
      service.handleErrorMessage(
        httpError([
          {
            code: '0x050001',
            message:
              'The conditions configured for this transition are not met',
          },
        ])
      )
    ).toBe('Las condiciones configuradas para esta transición no se cumplen');
  });

  it('names the failed transition condition from production public data', () => {
    expect(
      service.handleErrorMessage({
        response: {
          data: {
            message: 'The request could not be processed.',
            data: {
              code: '0x030004',
              conditions: {
                combinator: 'and',
                failed: [
                  {
                    field: 'cases.motivo_baja',
                    operator: '=',
                    value_type: 'text',
                    expected: 'MOTIVO-INEXISTENTE',
                    actual: 'MOTIVO-REAL',
                  },
                ],
              },
            },
            errors: [
              {
                code: '0x030004',
                message: 'The request could not be processed.',
              },
            ],
          },
        },
      })
    ).toBe(
      'No se puede cambiar el estado: el campo «Motivo baja» debe ser «MOTIVO-INEXISTENTE» (actualmente es «MOTIVO-REAL»).'
    );
  });

  it('names the field with the label the tenant configured', () => {
    const labeled = new CaseService({ apiService: {}, store: {} });
    labeled.storeService = {
      get: (path) =>
        path === 'config.global_config.layouts.application.admin'
          ? { classifications: { label_2: 'Tipo de solicitud' } }
          : undefined,
    };

    expect(
      labeled.handleErrorMessage(
        httpError([{ code: '0x030004' }], {
          conditions: {
            combinator: 'and',
            failed: [
              {
                field: 'clasificaciones.nivel2',
                operator: '=',
                expected: 'Queja',
                actual: 'Petición',
              },
            ],
          },
        })
      )
    ).toBe(
      'No se puede cambiar el estado: el campo «Tipo de solicitud» de la clasificación debe ser «Queja» (actualmente es «Petición»).'
    );
  });
});

describe('CaseService.validateCaseFields transition requirement', () => {
  const buildService = ({ caseRequireStateChange }) => {
    const service = new CaseService({ apiService: {}, store: {} });
    service.storeService = {
      get: vi.fn((key) => {
        if (key === 'aux_case.hasSchema') return false;
        if (key === 'cases.case_data')
          return { transicion_id: 'state-current' };
        if (key === 'config.global_config.behaviors.application.agente.casos') {
          return {
            case_require_state_change: caseRequireStateChange,
            allow_description_empty: true,
          };
        }
        return null;
      }),
    };
    return service;
  };

  const editCaseWithoutTransition = () => ({
    cliente_id: 'client-1',
    transicion_id: null,
    clasificacion_id: 'classification-1',
    responsable_id: 'user-1',
    descripcion_caso_id: 'description-1',
    grupo_id: 'group-1',
  });

  it('allows editing without selecting a state when the global setting is disabled', async () => {
    const service = buildService({ caseRequireStateChange: false });

    await expect(
      service.validateCaseFields(
        editCaseWithoutTransition(),
        {},
        'description',
        true
      )
    ).resolves.toBeUndefined();
  });

  it('requires a state during editing when the global setting is enabled', async () => {
    const service = buildService({ caseRequireStateChange: true });

    await expect(
      service.validateCaseFields(
        editCaseWithoutTransition(),
        {},
        'description',
        true
      )
    ).rejects.toThrow('El campo: estados es requerido');
  });

  it('backfills the current transition id when the global setting is disabled and no state was selected', async () => {
    const service = buildService({ caseRequireStateChange: false });
    const caseData = editCaseWithoutTransition();

    await service.validateCaseFields(caseData, {}, 'description', true);

    expect(caseData.transicion_id).toBe('state-current');
  });

  it('does not override a state the user actually picked', async () => {
    const service = buildService({ caseRequireStateChange: false });
    const caseData = {
      ...editCaseWithoutTransition(),
      transicion_id: 'state-picked',
    };

    await service.validateCaseFields(caseData, {}, 'description', true);

    expect(caseData.transicion_id).toBe('state-picked');
  });

  it('backfills from the rebased edit snapshot instead of the stale cases.case_data after a reclassification', async () => {
    const service = new CaseService({ apiService: {}, store: {} });
    service.storeService = {
      get: vi.fn((key) => {
        if (key === 'aux_case.hasSchema') return false;
        // GET original: todavía el flujo VIEJO, no refrescado tras reclasificar.
        if (key === 'cases.case_data')
          return { transicion_id: 'state-old-flow' };
        // Rebasado por reclassifyCase() a la transición del flujo DESTINO.
        if (key === 'cases.edit_snapshot') {
          return { case: { transicion_id: 'state-new-flow' } };
        }
        if (key === 'config.global_config.behaviors.application.agente.casos') {
          return {
            case_require_state_change: false,
            allow_description_empty: true,
          };
        }
        return null;
      }),
    };
    const caseData = editCaseWithoutTransition();

    await service.validateCaseFields(caseData, {}, 'description', true);

    expect(caseData.transicion_id).toBe('state-new-flow');
  });

  it('does not backfill on create, where a transition is always required', async () => {
    const service = buildService({ caseRequireStateChange: false });
    const caseData = editCaseWithoutTransition();

    await expect(
      service.validateCaseFields(caseData, {}, 'description', false)
    ).rejects.toThrow('El campo: estados es requerido');
    expect(caseData.transicion_id).toBeNull();
  });
});

describe('CaseService.createCase', () => {
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
    service = new CaseService({
      apiService: {
        post: vi.fn(),
      },
      store: {},
    });
    service.submitCaseData = vi.fn();
    service.storeService = { get: vi.fn(), set: vi.fn() };
  });

  it('returns staleCodes from envelope data.warnings', async () => {
    service.submitCaseData.mockResolvedValueOnce({
      data: {
        data: {
          warnings: [
            { code: CASE_TRANSITION_STALE },
            { code: CASE_RESPONSIBLE_STALE },
          ],
        },
      },
    });

    const result = await service.createCase({
      caseData: { case: { id: '123' } },
      description: 'test',
    });

    expect(result).toEqual({
      staleCodes: [CASE_TRANSITION_STALE, CASE_RESPONSIBLE_STALE],
      caseId: '123',
    });
  });

  it('returns empty staleCodes when response has no warnings', async () => {
    service.submitCaseData.mockResolvedValueOnce({
      data: {
        data: { id: '789' },
      },
    });

    const result = await service.createCase({
      caseData: { case: { id: '789' } },
      description: 'test',
    });

    expect(result).toEqual({ staleCodes: [], caseId: '789' });
  });

  it('sets cases.case_id in the store when caseData.case.id exists', async () => {
    const caseData = { case: { id: 'abc' } };
    service.submitCaseData.mockResolvedValueOnce({ data: {} });

    await service.createCase({
      caseData,
      description: 'test',
    });

    expect(service.storeService.set).toHaveBeenCalledWith(
      'cases.case_id',
      'abc'
    );
    expect(removeKeysFromSubmissionData).toHaveBeenCalledWith(caseData);
  });

  it('prefers the server-assigned id over the locally generated caseData.case.id', async () => {
    const caseData = { case: { id: 'local-generated-id' } };
    service.submitCaseData.mockResolvedValueOnce({
      data: {
        data: { id: 'server-assigned-id' },
      },
    });

    const result = await service.createCase({
      caseData,
      description: 'test',
    });

    expect(result.caseId).toBe('server-assigned-id');
    expect(service.storeService.set).toHaveBeenCalledWith(
      'cases.case_id',
      'server-assigned-id'
    );
  });

  it('posts the interaction-case relation after successfully creating a case when handshake has interaction_id', async () => {
    const caseData = { case: { id: 'case-123' } };
    service.storeService.get.mockImplementation((key) =>
      key === 'auth.handshake_params'
        ? { interaction_id: 'interaction-456' }
        : undefined
    );
    service.submitCaseData.mockResolvedValueOnce({ data: {} });
    service.api.post.mockResolvedValueOnce({ status: 201 });

    await service.createCase({
      caseData,
      description: 'test',
    });

    expect(service.api.post).toHaveBeenCalledWith(
      '/interactions/interaction-cases',
      {
        interaction_id: 'interaction-456',
        caso_id: 'case-123',
      }
    );
    expect(service.submitCaseData.mock.invocationCallOrder[0]).toBeLessThan(
      service.api.post.mock.invocationCallOrder[0]
    );
  });

  it('posts the interaction-case relation using interaction_id from the iframe URL when handshake params are unavailable', async () => {
    window.history.replaceState(
      {},
      '',
      '/render?interaction_id=interaction-from-url'
    );
    const caseData = { case: { id: 'case-from-submission' } };
    service.storeService.get.mockReturnValue(undefined);
    service.submitCaseData.mockResolvedValueOnce({ data: {} });
    service.api.post.mockResolvedValueOnce({ status: 201 });

    await service.createCase({
      caseData,
      description: 'test',
    });

    expect(service.api.post).toHaveBeenCalledWith(
      '/interactions/interaction-cases',
      {
        interaction_id: 'interaction-from-url',
        caso_id: 'case-from-submission',
      }
    );
  });

  it.each([
    ['empty handshake params', {}],
    ['general handshake params', { session_id: 'session-abc' }],
  ])(
    'does not warn or post the interaction-case relation when %s lack an interaction marker',
    async (_label, handshakeParams) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const caseData = { case: { id: 'case-123' } };
      service.storeService.get.mockImplementation((key) =>
        key === 'auth.handshake_params' ? handshakeParams : undefined
      );
      service.submitCaseData.mockResolvedValueOnce({ data: {} });

      await service.createCase({
        caseData,
        description: 'test',
      });

      expect(warnSpy).not.toHaveBeenCalled();
      expect(service.api.post).not.toHaveBeenCalledWith(
        '/interactions/interaction-cases',
        expect.any(Object)
      );
      warnSpy.mockRestore();
    }
  );

  it('warns and skips the interaction-case relation when an explicit interaction marker is blank', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const caseData = { case: { id: 'case-123' } };
    service.storeService.get.mockImplementation((key) =>
      key === 'auth.handshake_params' ? { interaction_id: '' } : undefined
    );
    service.submitCaseData.mockResolvedValueOnce({ data: {} });

    await service.createCase({
      caseData,
      description: 'test',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      '[Kace] CaseService.createCase: no interaction_id found; skipping interaction-case relation'
    );
    expect(service.api.post).not.toHaveBeenCalledWith(
      '/interactions/interaction-cases',
      expect.any(Object)
    );
    warnSpy.mockRestore();
  });

  it('warns and skips the interaction-case relation when the iframe URL has a blank interaction marker', async () => {
    window.history.replaceState({}, '', '/render?interaction_id=');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const caseData = { case: { id: 'case-123' } };
    service.storeService.get.mockReturnValue(undefined);
    service.submitCaseData.mockResolvedValueOnce({ data: {} });

    await service.createCase({
      caseData,
      description: 'test',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      '[Kace] CaseService.createCase: no interaction_id found; skipping interaction-case relation'
    );
    expect(service.api.post).not.toHaveBeenCalledWith(
      '/interactions/interaction-cases',
      expect.any(Object)
    );
    warnSpy.mockRestore();
  });

  it('posts the interaction-case relation using the created case id from the API response when the submission lacks case.id', async () => {
    const caseData = { case: {} };
    service.storeService.get.mockImplementation((key) =>
      key === 'auth.handshake_params'
        ? { interaction_id: 'interaction-456' }
        : undefined
    );
    service.submitCaseData.mockResolvedValueOnce({
      data: {
        case: {
          id: 'case-from-response',
        },
      },
    });
    service.api.post.mockResolvedValueOnce({ status: 201 });

    await service.createCase({
      caseData,
      description: 'test',
    });

    expect(service.storeService.set).toHaveBeenCalledWith(
      'cases.case_id',
      'case-from-response'
    );
    expect(service.api.post).toHaveBeenCalledWith(
      '/interactions/interaction-cases',
      {
        interaction_id: 'interaction-456',
        caso_id: 'case-from-response',
      }
    );
  });

  it('does not throw when creating the interaction-case relation fails after case creation succeeds', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const caseData = { case: { id: 'case-123' } };
    service.storeService.get.mockImplementation((key) =>
      key === 'auth.handshake_params'
        ? { interaction_id: 'interaction-456' }
        : undefined
    );
    service.submitCaseData.mockResolvedValueOnce({ data: {} });
    service.api.post.mockRejectedValueOnce(new Error('Relation failed'));

    await expect(
      service.createCase({
        caseData,
        description: 'test',
      })
    ).resolves.toEqual({ staleCodes: [], caseId: 'case-123' });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('propagates errors from submitCaseData', async () => {
    service.submitCaseData.mockRejectedValue(new Error('Network error'));
    await expect(
      service.createCase({ caseData: { case: {} }, description: 'test' })
    ).rejects.toThrow('Network error');
  });
});

describe('CaseService.submitCaseData attachment upload ordering', () => {
  let service;
  let apiPost;

  const createCaseData = (caseId = 'case-123') => ({
    case: {
      id: caseId,
      cliente_id: 'client-123',
      transicion_id: 'transition-123',
      clasificacion_id: 'classification-123',
      responsable_id: 'user-123',
      descripcion_caso_id: 'description-123',
      grupo_id: 'group-123',
    },
    aux_cases: {
      caso_id: caseId,
      data: {},
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    apiPost = vi.fn().mockResolvedValue({
      data: {
        data: { id: 'case-123' },
      },
    });
    service = new CaseService({
      apiService: {
        post: apiPost,
      },
      store: {},
    });
    service.uploadPendingCaseAttachments = vi.fn().mockResolvedValue();
    service.storeService = {
      get: vi.fn(),
      set: vi.fn(),
    };
  });

  it('uploads pending attachments before creating a generated case so create actions can include them', async () => {
    service.storeService.get.mockImplementation((key) => {
      if (key === 'cases.generated_case_id') return 'case-123';
      return null;
    });

    await service.submitCaseData({
      caseData: createCaseData(),
      description: 'description',
    });

    expect(service.uploadPendingCaseAttachments).toHaveBeenCalledTimes(1);
    expect(service.uploadPendingCaseAttachments).toHaveBeenCalledWith(
      'case-123'
    );
    expect(
      service.uploadPendingCaseAttachments.mock.invocationCallOrder[0]
    ).toBeLessThan(apiPost.mock.invocationCallOrder[0]);
    expect(apiPost).toHaveBeenCalledWith(
      '/cases/auxiliary',
      expect.any(Object)
    );
  });

  it('uploads pending attachments before updating a case so update actions can include them', async () => {
    service.storeService.get.mockImplementation((key) => {
      if (key === 'cases.case_id') return 'case-123';
      return null;
    });

    await service.submitCaseData({
      caseData: createCaseData(),
      description: 'description',
    });

    expect(apiPost).toHaveBeenCalledWith(
      '/cases/auxiliary/case-123?override=true',
      expect.any(Object)
    );
    expect(service.uploadPendingCaseAttachments).toHaveBeenCalledTimes(1);
    expect(service.uploadPendingCaseAttachments).toHaveBeenCalledWith(
      'case-123'
    );
    expect(
      service.uploadPendingCaseAttachments.mock.invocationCallOrder[0]
    ).toBeLessThan(apiPost.mock.invocationCallOrder[0]);
  });
});

describe('CaseService.finishTimerAfterSubmit', () => {
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    service = new CaseService({
      apiService: { post: vi.fn() },
      store: {},
    });
    service.storeService = {
      get: vi.fn((key) => {
        if (key === 'cases.generated_case_id') return 'generated-id';
        if (key === 'cases.case_id') return 'generated-id';
        return null;
      }),
    };
    service.createTimer = vi
      .fn()
      .mockResolvedValue({ data: { id: 'new-timer' } });
    service.updateTimer = vi.fn();
  });

  it('creates and finishes timer when creating a case with a local timer', async () => {
    localStorage.setItem(
      'caseTimer',
      JSON.stringify({ timerId: 'local-timer', localOnly: true })
    );

    await service.finishTimerAfterSubmit('local-timer', 'Formulario Guardado');

    expect(service.createTimer).toHaveBeenCalledWith({
      caseId: 'generated-id',
    });
    expect(service.updateTimer).toHaveBeenCalledWith(
      'new-timer',
      'FINISHED',
      'Formulario Guardado'
    );
  });

  it('updates existing timer when editing a case', async () => {
    service.storeService.get = vi.fn((key) => {
      if (key === 'cases.case_id') return 'existing-id';
      return null;
    });

    await service.finishTimerAfterSubmit(
      'existing-timer',
      'Formulario Guardado'
    );

    expect(service.createTimer).not.toHaveBeenCalled();
    expect(service.updateTimer).toHaveBeenCalledWith(
      'existing-timer',
      'FINISHED',
      'Formulario Guardado'
    );
  });
});

describe('CaseService.applyEmbeddedPayloadFlags', () => {
  it('normalizes embedded backend attachment type into attachmentType for the UI', () => {
    const service = new CaseService({
      apiService: { post: vi.fn() },
      store: {},
    });
    service.storeService = {
      get: vi.fn(),
      set: vi.fn(),
    };

    service.applyEmbeddedPayloadFlags({
      id: 'case-123',
      attachments: [
        {
          id: 'attachment-1',
          path: 'DJI_0060_Moment.jpg',
          description: 'image/jpeg',
          type: 2,
        },
      ],
    });

    expect(service.storeService.set).toHaveBeenCalledWith('cases.attachments', [
      expect.objectContaining({
        id: 'attachment-1',
        type: 2,
        attachmentType: 2,
      }),
    ]);
    expect(service.storeService.set).toHaveBeenCalledWith(
      'cases.attachments_prefetched',
      true
    );
  });
});

describe('CaseService.submitCaseData description lock', () => {
  const buildService = (casosConfig) => {
    const apiPost = vi
      .fn()
      .mockResolvedValue({ data: { data: { id: 'case-123' } } });
    const service = new CaseService({
      apiService: { post: apiPost },
      store: {},
    });
    service.uploadPendingCaseAttachments = vi.fn().mockResolvedValue();
    service.storeService = {
      get: vi.fn((key) => {
        if (key === 'cases.case_id') return 'case-123';
        if (key === 'config.global_config.behaviors.application.agente.casos')
          return casosConfig;
        return null;
      }),
      set: vi.fn(),
    };
    return { service, apiPost };
  };

  const updateCaseData = () => ({
    case: {
      id: 'case-123',
      cliente_id: 'client-1',
      transicion_id: 't-1',
      clasificacion_id: 'c-1',
      responsable_id: 'u-1',
      descripcion_caso_id: 'd-1',
      grupo_id: 'g-1',
    },
    aux_cases: { caso_id: 'case-123', data: {} },
  });

  it('omits description from the update payload when lock_case_description_edit is true', async () => {
    const { service, apiPost } = buildService({
      lock_case_description_edit: true,
    });

    await service.submitCaseData({
      caseData: updateCaseData(),
      description: 'should-not-be-sent',
    });

    const [, body] = apiPost.mock.calls[0];
    expect(body).not.toHaveProperty('description');
  });

  it('omits description on a non-recorte update when the lock is true', async () => {
    const { service, apiPost } = buildService({
      lock_case_description_edit: true,
    });
    service.storeService.get = vi.fn((key) => {
      if (key === 'cases.case_id') return 'parent-999';
      if (key === 'config.global_config.behaviors.application.agente.casos') {
        return { lock_case_description_edit: true };
      }
      return null;
    });

    await service.submitCaseData({
      caseData: updateCaseData(),
      description: 'should-not-be-sent',
    });

    const [, body] = apiPost.mock.calls[0];
    expect(body).not.toHaveProperty('description');
  });

  it('includes description in the update payload when the flag is false', async () => {
    const { service, apiPost } = buildService({
      lock_case_description_edit: false,
    });

    await service.submitCaseData({
      caseData: updateCaseData(),
      description: 'sent-as-usual',
    });

    const [, body] = apiPost.mock.calls[0];
    expect(body).toHaveProperty('description');
    expect(body.description).toEqual({
      id: 'd-1',
      descripcion: 'sent-as-usual',
    });
  });

  it('includes description in the create payload even when the flag is true', async () => {
    const apiPost = vi
      .fn()
      .mockResolvedValue({ data: { data: { id: 'case-123' } } });
    const service = new CaseService({
      apiService: { post: apiPost },
      store: {},
    });
    service.uploadPendingCaseAttachments = vi.fn().mockResolvedValue();
    service.storeService = {
      get: vi.fn((key) => {
        if (key === 'cases.generated_case_id') return 'case-123';
        if (key === 'config.global_config.behaviors.application.agente.casos') {
          return { lock_case_description_edit: true };
        }
        return null;
      }),
      set: vi.fn(),
    };

    await service.submitCaseData({
      caseData: {
        case: { id: 'case-123', descripcion_caso_id: 'd-1' },
        aux_cases: { caso_id: 'case-123', data: {} },
      },
      description: 'created-with-description',
    });

    const [, body] = apiPost.mock.calls[0];
    expect(body).toHaveProperty('description');
    expect(apiPost.mock.calls[0][0]).toBe('/cases/auxiliary');
  });
});

describe('CaseService.submitCaseData', () => {
  let service;
  let apiPost;

  const editSnapshot = {
    case: {
      cliente_id: 'c1',
      transicion_id: 't1',
      clasificacion_id: 'cl1',
      responsable_id: 'r1',
      grupo_id: 'g1',
      descripcion_caso_id: 'd1',
    },
    aux_cases: { data: {} },
    description: '<p>hello</p>',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiPost = vi.fn().mockResolvedValue({ data: { data: { id: 'case-1' } } });
    service = new CaseService({
      apiService: { post: apiPost },
      store: {},
    });
  });

  it('posts only dirty case fields on update', async () => {
    storeService.get.mockImplementation((key) => {
      if (key === 'cases.case_id') return 'case-1';
      if (key === 'cases.generated_case_id') return null;
      if (key === 'cases.edit_snapshot') return editSnapshot;
      if (key === 'cases.attachments') return [];
      return null;
    });

    await service.submitCaseData({
      caseData: {
        case: {
          ...editSnapshot.case,
          transicion_id: 't2',
        },
        aux_cases: { data: {} },
      },
      description: '<p>hello</p>',
      uploadAttachments: false,
    });

    expect(apiPost).toHaveBeenCalledTimes(1);
    const payload = apiPost.mock.calls[0][1];
    expect(payload).toEqual(
      expect.objectContaining({
        case: expect.objectContaining({ transicion_id: 't2' }),
      })
    );
    expect(payload.case.cliente_id).toBeUndefined();
    expect(payload.aux_cases).toEqual({});
    expect(payload.description).toBeUndefined();
    const refreshed = storeService.set.mock.calls.find(
      ([key]) => key === 'cases.edit_snapshot'
    )?.[1];
    expect(refreshed.case.transicion_id).toBe('t2');
    expect(refreshed.case.cliente_id).toBe('c1');
  });

  it('keeps the snapshot transition when the save reports it stale', async () => {
    apiPost.mockResolvedValue({
      data: {
        data: { id: 'case-1', warnings: [{ code: CASE_TRANSITION_STALE }] },
      },
    });
    storeService.get.mockImplementation((key) => {
      if (key === 'cases.case_id') return 'case-1';
      if (key === 'cases.generated_case_id') return null;
      if (key === 'cases.edit_snapshot') return editSnapshot;
      if (key === 'cases.attachments') return [];
      return null;
    });

    await service.submitCaseData({
      caseData: {
        case: {
          ...editSnapshot.case,
          transicion_id: 't2',
        },
        aux_cases: { data: {} },
      },
      description: '<p>hello</p>',
      uploadAttachments: false,
    });

    const refreshed = storeService.set.mock.calls.find(
      ([key]) => key === 'cases.edit_snapshot'
    )?.[1];
    expect(refreshed.case.transicion_id).toBe('t1');
  });

  it('posts sparse dirty nested aux objects on update', async () => {
    const snapshot = {
      case: { ...editSnapshot.case },
      aux_cases: { id: 'aux-1', data: { formA: { a: 1, b: 2 } } },
      description: '<p>hello</p>',
    };
    storeService.get.mockImplementation((key) => {
      if (key === 'cases.case_id') return 'case-1';
      if (key === 'cases.generated_case_id') return null;
      if (key === 'cases.edit_snapshot') return snapshot;
      if (key === 'cases.attachments') return [];
      return null;
    });

    await service.submitCaseData({
      caseData: {
        case: { ...snapshot.case },
        aux_cases: { data: { formA: { a: 9, b: 2 } } },
      },
      description: '<p>hello</p>',
      uploadAttachments: false,
    });

    const payload = apiPost.mock.calls[0][1];
    expect(payload.case).toEqual({});
    expect(payload.aux_cases.data).toEqual({ formA: { a: 9 } });
    expect(payload.description).toBeUndefined();
  });

  it('does not fill empty aux_cases with caso_id wrapper on update', async () => {
    storeService.get.mockImplementation((key) => {
      if (key === 'cases.case_id') return 'case-1';
      if (key === 'cases.generated_case_id') return null;
      if (key === 'cases.edit_snapshot') return editSnapshot;
      return null;
    });

    await service.submitCaseData({
      caseData: {
        case: {
          ...editSnapshot.case,
          transicion_id: 't2',
        },
        aux_cases: {},
      },
      description: '<p>hello</p>',
      uploadAttachments: false,
    });

    const payload = apiPost.mock.calls[0][1];
    expect(payload.aux_cases).toEqual({});
    expect(payload.aux_cases.caso_id).toBeUndefined();
  });

  it('posts full case payload on create when generated_case_id and case_id match', async () => {
    storeService.get.mockImplementation((key) => {
      if (key === 'cases.generated_case_id') return 'generated-1';
      if (key === 'cases.case_id') return 'generated-1';
      if (key === 'cases.edit_snapshot') return editSnapshot;
      return null;
    });

    await service.submitCaseData({
      caseData: {
        case: {
          ...editSnapshot.case,
          id: 'generated-1',
        },
        aux_cases: { data: {} },
      },
      description: '<p>hello</p>',
      uploadAttachments: false,
    });

    expect(apiPost).toHaveBeenCalledWith(
      '/cases/auxiliary',
      expect.objectContaining({
        case: expect.objectContaining({ cliente_id: 'c1' }),
        description: {
          id: 'd1',
          descripcion: '<p>hello</p>',
        },
      })
    );
  });

  it('posts full case payload on create even when equal to a snapshot', async () => {
    storeService.get.mockImplementation((key) => {
      if (key === 'cases.generated_case_id') return 'generated-1';
      if (key === 'cases.case_id') return null;
      if (key === 'cases.edit_snapshot') return editSnapshot;
      return null;
    });

    await service.submitCaseData({
      caseData: {
        case: {
          ...editSnapshot.case,
          id: 'generated-1',
        },
        aux_cases: { data: {} },
      },
      description: '<p>hello</p>',
      uploadAttachments: false,
    });

    expect(apiPost).toHaveBeenCalledWith(
      '/cases/auxiliary',
      expect.objectContaining({
        case: expect.objectContaining({ cliente_id: 'c1' }),
        description: {
          id: 'd1',
          descripcion: '<p>hello</p>',
        },
      })
    );
  });

  it('posts full subcase envelope when target id differs from hydrated parent', async () => {
    const parentSnapshot = {
      case: {
        cliente_id: 'c1',
        transicion_id: 't1',
        clasificacion_id: 'cl1',
        responsable_id: 'r1',
        grupo_id: 'g1',
        descripcion_caso_id: 'd-parent',
      },
      aux_cases: { data: { formA: { a: 1, b: 2 } } },
      description: '<p>parent html</p>',
    };
    const subcaseLive = {
      case: {
        cliente_id: 'c1',
        transicion_id: 't-sub',
        clasificacion_id: 'cl-sub',
        responsable_id: 'r-sub',
        grupo_id: 'g-sub',
        descripcion_caso_id: 'd-sub',
        parent_id: 'case-1',
      },
      aux_cases: {
        id: 'aux-sub',
        data: { formA: { a: 1, b: 2 }, formB: { x: 1 } },
      },
    };

    storeService.get.mockImplementation((key) => {
      if (key === 'cases.case_id') return 'case-1';
      if (key === 'cases.generated_case_id') return null;
      if (key === 'cases.edit_snapshot') return parentSnapshot;
      if (key === 'cases.attachments') return [];
      return null;
    });

    await service.submitCaseData({
      caseData: subcaseLive,
      description: '<p>subcase html</p>',
      id: 'subcase-9',
      uploadAttachments: false,
    });

    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost.mock.calls[0][0]).toBe(
      '/cases/auxiliary/subcase-9?override=true'
    );
    const payload = apiPost.mock.calls[0][1];
    expect(payload.case.cliente_id).toBe('c1');
    expect(payload.case.transicion_id).toBe('t-sub');
    expect(payload.aux_cases).toEqual({
      id: 'aux-sub',
      data: { formA: { a: 1, b: 2 }, formB: { x: 1 } },
    });
    expect(payload.description).toEqual({
      id: 'd-sub',
      descripcion: '<p>subcase html</p>',
    });
  });

  it('incluye comment.descripcion en el POST auxiliary cuando hay intento de reclasificar', async () => {
    storeService.get.mockImplementation((key) => {
      if (key === 'cases.case_id') return null;
      if (key === 'cases.generated_case_id') return null;
      if (key === 'classifications.reclassification_reason') {
        return '  Cambio de tipología, no de estado.  ';
      }
      return null;
    });

    await service.submitCaseData({
      caseData: {
        case: {
          clasificacion_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          current_clasificacion_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          transicion_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        },
        aux_cases: {},
      },
      description: '',
      id: '55555555-5555-4555-8555-555555555555',
      uploadAttachments: false,
    });

    const posted = apiPost.mock.calls[0][1];
    expect(posted.comment).toEqual({
      descripcion: 'Cambio de tipología, no de estado.',
    });
    expect(storeService.set).toHaveBeenCalledWith(
      'classifications.reclassification_reason',
      null
    );
  });

  it('no llama al POST si hay intento y el motivo tiene menos de 3 caracteres', async () => {
    storeService.get.mockImplementation((key) => {
      if (key === 'cases.case_id') return null;
      if (key === 'cases.generated_case_id') return null;
      if (key === 'classifications.reclassification_reason') return 'ab';
      return null;
    });

    await expect(
      service.submitCaseData({
        caseData: {
          case: {
            clasificacion_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            current_clasificacion_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          },
          aux_cases: {},
        },
        description: '',
        id: '55555555-5555-4555-8555-555555555555',
        uploadAttachments: false,
      })
    ).rejects.toThrow(/motivo de la reclasificación/i);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('keeps the form case ids when the update fails, so a retry still targets the case', async () => {
    apiPost.mockRejectedValue(new Error('Bad request'));
    storeService.get.mockImplementation((key) => {
      if (key === 'cases.generated_case_id') return null;
      if (key === 'cases.attachments') return [];
      return null;
    });
    const caseData = {
      case: { id: 'case-1', transicion_id: 't1' },
      aux_cases: { caso_id: 'case-1', data: {} },
    };

    await expect(
      service.submitCaseData({
        caseData,
        description: '',
        uploadAttachments: false,
      })
    ).rejects.toThrow();

    expect(apiPost.mock.calls[0][0]).toBe(
      '/cases/auxiliary/case-1?override=true'
    );
    expect(apiPost.mock.calls[0][1].case.id).toBeUndefined();
    expect(caseData.case.id).toBe('case-1');
    expect(caseData.aux_cases.caso_id).toBe('case-1');
  });
});

describe('CaseService.fetchReclassificationPrecheck', () => {
  let service;
  let get;

  beforeEach(() => {
    vi.clearAllMocks();
    get = vi.fn();
    service = new CaseService({ apiService: { get }, store: {} });
    service.storeService = { get: vi.fn(), set: vi.fn() };
  });

  const params = { caseId: 'caso-1', clasificacionId: 'clas-otra' };

  it('consulta el endpoint del precheck con la clasificación destino', async () => {
    get.mockResolvedValue({ data: { data: { eligible: true, states: [] } } });

    await service.fetchReclassificationPrecheck(params);

    expect(get).toHaveBeenCalledWith('/case-reclassification-precheck/caso-1', {
      params: { clasificacion_id: 'clas-otra' },
    });
  });

  it('normaliza la respuesta elegible con estados y reglas', async () => {
    get.mockResolvedValue({
      data: {
        data: {
          eligible: true,
          blocker: null,
          states: [{ transition: { id: 't1' } }],
          transition_rules: [{ transicion_id: 't1', rules: [] }],
        },
      },
    });

    const result = await service.fetchReclassificationPrecheck(params);

    expect(result).toEqual({
      eligible: true,
      blocker: null,
      states: [{ transition: { id: 't1' } }],
      transitionRules: [{ transicion_id: 't1', rules: [] }],
    });
  });

  it('devuelve el bloqueo sin lanzar: un "no" de negocio es una respuesta válida', async () => {
    get.mockResolvedValue({
      data: {
        data: {
          eligible: false,
          blocker: { code: '0x030057', message: 'Tiene subcasos activos' },
          states: [],
          transition_rules: [],
        },
      },
    });

    const result = await service.fetchReclassificationPrecheck(params);

    expect(result.eligible).toBe(false);
    expect(result.blocker).toEqual({
      code: '0x030057',
      message: 'Tiene subcasos activos',
    });
  });

  it('trata un cuerpo incompleto como no elegible, sin reventar', async () => {
    get.mockResolvedValue({ data: {} });

    const result = await service.fetchReclassificationPrecheck(params);

    expect(result).toEqual({
      eligible: false,
      blocker: null,
      states: [],
      transitionRules: [],
    });
  });

  it('propaga el rechazo de la llamada, que no es un "no" de negocio', async () => {
    const httpError = new Error('Network Error');
    get.mockRejectedValue(httpError);

    await expect(service.fetchReclassificationPrecheck(params)).rejects.toThrow(
      'Network Error'
    );
  });

  it.each([
    [
      { caseId: '', clasificacionId: 'clas-otra' },
      'El ID del caso es requerido',
    ],
    [
      { caseId: 'caso-1', clasificacionId: '' },
      'La clasificación destino es requerida',
    ],
  ])('exige %o antes de llamar al API', async (args, mensaje) => {
    await expect(service.fetchReclassificationPrecheck(args)).rejects.toThrow(
      mensaje
    );
    expect(get).not.toHaveBeenCalled();
  });
});

describe('CaseService.reclassifyCase', () => {
  let service;
  let post;
  let storeValues;

  const params = {
    caseId: 'caso-1',
    clasificacionId: 'clas-otra',
    transicionId: 'trans-nueva',
    currentClasificacionId: 'clas-actual',
    motivo: 'Venta confirmada',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    post = vi.fn().mockResolvedValue({ status: 200 });
    storeValues = {};
    service = new CaseService({ apiService: { post }, store: {} });
    service.storeService = {
      get: (path) => storeValues[path],
      set: (path, value) => {
        storeValues[path] = value;
      },
    };
  });

  it('manda la clasificación destino y la transición al endpoint del caso', async () => {
    await service.reclassifyCase(params);

    expect(post).toHaveBeenCalledWith('/case-reclassification/caso-1', {
      clasificacion_id: 'clas-otra',
      transicion_id: 'trans-nueva',
      current_clasificacion_id: 'clas-actual',
      comment: { descripcion: 'Venta confirmada' },
    });
  });

  it('incluye el motivo como comment.descripcion', async () => {
    await service.reclassifyCase({ ...params, motivo: '  Venta confirmada  ' });

    expect(post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ comment: { descripcion: 'Venta confirmada' } })
    );
  });

  it.each(['', '   ', 'ab', undefined])(
    'rechaza un motivo de %p porque Joi exige comment.descripcion min(3)',
    async (motivo) => {
      await expect(
        service.reclassifyCase({ ...params, motivo })
      ).rejects.toThrow(/motivo de la reclasificación/i);
      expect(post).not.toHaveBeenCalled();
    }
  );

  it('no reporta motivo descartado cuando el motivo sí viajó', async () => {
    const outcome = await service.reclassifyCase({
      ...params,
      motivo: 'Venta confirmada',
    });

    expect(outcome.reasonDiscarded).toBe(false);
  });

  it('deja la marca de reclasificación aplicada para el guardado auxiliar', async () => {
    await service.reclassifyCase(params);

    expect(storeValues['classifications.reclassification_applied']).toEqual({
      case_id: 'caso-1',
      clasificacion_id: 'clas-otra',
    });
  });

  it('descarta el motivo ya enviado, para que un reintento no lo repita', async () => {
    storeValues['classifications.reclassification_reason'] = 'Ya viajó';

    await service.reclassifyCase({ ...params, motivo: 'Ya viajó' });

    expect(storeValues['classifications.reclassification_reason']).toBeNull();
  });

  it('rebasa el snapshot para que el guardado auxiliar no reenvíe lo ya guardado', async () => {
    storeValues['cases.edit_snapshot'] = {
      case: { clasificacion_id: 'clas-actual', transicion_id: 'trans-vieja' },
      aux_cases: { data: { campo: 1 } },
    };

    await service.reclassifyCase(params);

    expect(storeValues['cases.edit_snapshot']).toEqual({
      case: { clasificacion_id: 'clas-otra', transicion_id: 'trans-nueva' },
      aux_cases: { data: { campo: 1 } },
    });
  });

  it('no inventa un snapshot si no había uno', async () => {
    await service.reclassifyCase(params);

    expect(storeValues['cases.edit_snapshot']).toBeUndefined();
  });

  it('propaga el rechazo del backend sin dejar la marca', async () => {
    post.mockRejectedValue(new Error('El caso fue modificado'));

    await expect(service.reclassifyCase(params)).rejects.toThrow(
      'El caso fue modificado'
    );
    expect(
      storeValues['classifications.reclassification_applied']
    ).toBeUndefined();
  });

  it.each([
    [{ ...params, caseId: '' }, 'El ID del caso es requerido'],
    [
      { ...params, clasificacionId: '' },
      'La clasificación destino es requerida',
    ],
    [{ ...params, transicionId: '' }, 'Debe seleccionar un estado'],
  ])(
    'exige los datos mínimos antes de llamar al API',
    async (args, mensaje) => {
      await expect(service.reclassifyCase(args)).rejects.toThrow(mensaje);
      expect(post).not.toHaveBeenCalled();
    }
  );
});

describe('CaseService.submitCaseData con una reclasificación aplicada', () => {
  let service;
  let apiPost;
  let storeValues;

  const caseData = () => ({
    case: { id: 'case-123', descripcion_caso_id: 'desc-1' },
    aux_cases: { caso_id: 'case-123', data: {} },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    apiPost = vi.fn().mockResolvedValue({ data: { data: { id: 'case-123' } } });
    storeValues = { 'cases.case_id': 'case-123' };
    service = new CaseService({ apiService: { post: apiPost }, store: {} });
    service.uploadPendingCaseAttachments = vi.fn().mockResolvedValue();
    service.storeService = {
      get: (path) => storeValues[path],
      set: (path, value) => {
        storeValues[path] = value;
      },
    };
  });

  it('limpia la marca cuando el guardado auxiliar aterriza', async () => {
    storeValues['classifications.reclassification_applied'] = {
      case_id: 'case-123',
      clasificacion_id: 'clas-otra',
    };

    await service.submitCaseData({
      caseData: caseData(),
      description: 'descripción',
    });

    expect(storeValues['classifications.reclassification_applied']).toBeNull();
  });

  it('avisa de que el caso ya quedó reclasificado si el guardado falla', async () => {
    storeValues['classifications.reclassification_applied'] = {
      case_id: 'case-123',
      clasificacion_id: 'clas-otra',
    };
    apiPost.mockRejectedValue(new Error('Campo obligatorio faltante'));

    await expect(
      service.submitCaseData({
        caseData: caseData(),
        description: 'descripción',
      })
    ).rejects.toThrow(/ya quedó reclasificado/i);
  });

  it('sin reclasificación pendiente el error de guardado es el de siempre', async () => {
    apiPost.mockRejectedValue(new Error('Campo obligatorio faltante'));

    await expect(
      service.submitCaseData({
        caseData: caseData(),
        description: 'descripción',
      })
    ).rejects.toThrow(/Error guardando el caso/);
  });

  /*
   * La marca vive en localStorage y sobrevive al cambio de caso, por eso guarda su `case_id`.
   * Sin compararlo, un residuo del caso anterior contamina el guardado del caso actual.
   */
  describe('marca residual de otro caso', () => {
    beforeEach(() => {
      storeValues['classifications.reclassification_applied'] = {
        case_id: 'case-anterior',
        clasificacion_id: 'clas-otra',
      };
    });

    it('no anuncia una reclasificación a medias que no es de este caso', async () => {
      apiPost.mockRejectedValue(new Error('Campo obligatorio faltante'));

      await expect(
        service.submitCaseData({
          caseData: caseData(),
          description: 'descripción',
        })
      ).rejects.toThrow(/Error guardando el caso/);
    });

    it('no borra la marca del caso anterior al guardar este', async () => {
      await service.submitCaseData({
        caseData: caseData(),
        description: 'descripción',
      });

      expect(storeValues['classifications.reclassification_applied']).toEqual({
        case_id: 'case-anterior',
        clasificacion_id: 'clas-otra',
      });
    });
  });
});

// ─── MSKT-1392 ronda 2: la marca de reclasificación NO es del caso padre ─────

describe('CaseService.submitCaseData reclassification marker ownership', () => {
  const APPLIED_PATH = 'classifications.reclassification_applied';
  const PARENT_ID = 'case-padre-1';

  let service;
  let apiPost;
  let store;

  const withParentReclassified = () => {
    store[APPLIED_PATH] = {
      case_id: PARENT_ID,
      clasificacion_id: 'clas-destino',
    };
  };

  /** Payload tal y como lo arma `useSubcases` al CREAR un subcaso: sin id propio todavía. */
  const newSubcasePayload = () => ({
    case: {
      parent_id: PARENT_ID,
      cliente_id: 'client-1',
      transicion_id: 'transition-1',
      clasificacion_id: 'clas-subcaso',
      descripcion_caso_id: 'desc-1',
      grupo_id: 'group-1',
    },
    aux_cases: { data: {} },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    store = {};
    apiPost = vi
      .fn()
      .mockResolvedValue({ data: { data: { id: 'subcase-1' } } });
    service = new CaseService({ apiService: { post: apiPost }, store: {} });
    service.uploadPendingCaseAttachments = vi.fn().mockResolvedValue();
    service.storeService = {
      get: vi.fn((key) => (key === 'cases.case_id' ? PARENT_ID : store[key])),
      set: vi.fn((key, value) => {
        store[key] = value;
      }),
    };
  });

  it('no borra la marca del caso padre al crear un subcaso con éxito', async () => {
    withParentReclassified();

    await service.submitCaseData({
      caseData: newSubcasePayload(),
      description: 'desc',
      id: null,
      uploadAttachments: false,
    });

    expect(service.storeService.set).not.toHaveBeenCalledWith(
      APPLIED_PATH,
      null
    );
    expect(store[APPLIED_PATH]).toEqual({
      case_id: PARENT_ID,
      clasificacion_id: 'clas-destino',
    });
  });

  it('no atribuye al subcaso el mensaje de reclasificación del padre cuando el guardado falla', async () => {
    withParentReclassified();
    apiPost.mockRejectedValueOnce(new Error('fallo de red'));

    await expect(
      service.submitCaseData({
        caseData: newSubcasePayload(),
        description: 'desc',
        id: null,
        uploadAttachments: false,
      })
    ).rejects.toThrow(/Error guardando el caso/);
  });

  it('sigue limpiando la marca cuando el guardado sí es del caso reclasificado', async () => {
    withParentReclassified();

    await service.submitCaseData({
      caseData: {
        case: { id: PARENT_ID, cliente_id: 'client-1' },
        aux_cases: { caso_id: PARENT_ID, data: {} },
      },
      description: 'desc',
      uploadAttachments: false,
    });

    expect(service.storeService.set).toHaveBeenCalledWith(APPLIED_PATH, null);
  });

  it('sigue avisando de la reclasificación a medias cuando falla el guardado del propio caso', async () => {
    withParentReclassified();
    apiPost.mockRejectedValueOnce(new Error('fallo de red'));

    await expect(
      service.submitCaseData({
        caseData: {
          case: { id: PARENT_ID, cliente_id: 'client-1' },
          aux_cases: { caso_id: PARENT_ID, data: {} },
        },
        description: 'desc',
        uploadAttachments: false,
      })
    ).rejects.toThrow(/ya quedó reclasificado/);
  });

  /**
   * Un subcaso abierto COMO caso principal sí lleva `parent_id` y sí es el caso que se guarda:
   * el descarte mira que el `parent_id` sea justo el id al que iba a caer el fallback, no la mera
   * presencia del campo.
   */
  it('no descarta un caso que lleva parent_id pero es el caso que se está guardando', async () => {
    const SUBCASO_ID = 'case-hijo-1';
    store[APPLIED_PATH] = {
      case_id: SUBCASO_ID,
      clasificacion_id: 'clas-destino',
    };

    await service.submitCaseData({
      caseData: {
        // El `parent_id` SÍ coincide con el `cases.case_id` del store —es el valor al que caería
        // el fallback—, y aun así no se descarta: el subcaso trae id propio, así que es él y no
        // su padre el caso que se está guardando.
        case: { id: SUBCASO_ID, parent_id: PARENT_ID, cliente_id: 'client-1' },
        aux_cases: { caso_id: SUBCASO_ID, data: {} },
      },
      description: 'desc',
      uploadAttachments: false,
    });

    expect(service.storeService.set).toHaveBeenCalledWith(APPLIED_PATH, null);
  });

  /**
   * La otra mitad del mismo contrato: sin id propio, un `parent_id` que coincide con el
   * `cases.case_id` del store es exactamente el caso que hay que descartar —el fallback apuntaría
   * al padre—, y la marca del padre tiene que sobrevivir.
   */
  it('descarta el caso cuando el parent_id coincide con el fallback y no hay id propio', async () => {
    withParentReclassified();

    await service.submitCaseData({
      caseData: {
        case: { parent_id: PARENT_ID, cliente_id: 'client-1' },
        aux_cases: { data: {} },
      },
      description: 'desc',
      uploadAttachments: false,
    });

    expect(service.storeService.set).not.toHaveBeenCalledWith(
      APPLIED_PATH,
      null
    );
    expect(store[APPLIED_PATH]).toEqual({
      case_id: PARENT_ID,
      clasificacion_id: 'clas-destino',
    });
  });
});

describe('CaseService.updateState', () => {
  const rejectedByRule = {
    message: 'Request failed with status code 400',
    response: {
      data: {
        errors: [{ code: '0x030004' }],
        data: {
          conditions: {
            combinator: 'and',
            failed: [
              {
                field: 'cases.responsable_id',
                operator: '=',
                expected: 'u-1',
                expected_label: 'Camilo Londoño',
                actual: 'u-2',
                actual_label: 'Pedro Pérez',
              },
            ],
          },
        },
      },
    },
  };

  const buildService = (post) => {
    const service = new CaseService({ apiService: {}, store: {} });
    service.api = { post };
    service.storeService = {
      get: (key) => (key === 'cases.case_id' ? 'case-1' : undefined),
    };
    return service;
  };

  it('explains which transition condition blocked the state change', async () => {
    const service = buildService(vi.fn().mockRejectedValue(rejectedByRule));

    await expect(service.updateState({ transition_id: 't-1' })).rejects.toThrow(
      'Error al actualizar estado: No se puede cambiar el estado: el responsable debe ser «Camilo Londoño» (actualmente es «Pedro Pérez»).'
    );
  });

  it('keeps its own validation messages', async () => {
    const service = buildService(vi.fn());

    await expect(service.updateState({})).rejects.toThrow(
      'Error al actualizar estado: El ID de la transición es requerido'
    );
  });
});
