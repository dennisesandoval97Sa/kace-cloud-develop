import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CASE_CLIENT_STALE } from '@kace/error-codes';
import { apiService } from '#services/apiService.js';
import { storeService } from '../services/storeService';
import { applySaveOutcomeToSnapshot } from '../utils/applySaveOutcomeToSnapshot.js';
import { RECLASSIFICATION_REASON_STORE_PATH } from './reclassification.constants.js';
import kace_data from './KaceData.js';

vi.mock('#services/apiService.js', () => ({
  apiService: { post: vi.fn(), get: vi.fn() },
}));

vi.mock('../services/storeService', () => ({
  storeService: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('../utils/applySaveOutcomeToSnapshot.js', () => ({
  applySaveOutcomeToSnapshot: vi.fn(),
}));

const CASE_ID = 'case-123';

const casePayload = () => ({
  case: { descripcion_caso_id: 'd-1', cliente_id: 'c-1' },
  aux_cases: { caso_id: CASE_ID, data: {} },
});

describe('KaceData._submitCaseData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kace_data.case_id = CASE_ID;
    kace_data.url_api = 'https://api.example';
    kace_data.attachments = [];
    kace_data.ignore_schema_keys = [];
    kace_data.generated_case_id = null;
    kace_data.global_config = {
      behaviors: {
        application: {
          agente: { casos: { lock_case_description_edit: false } },
        },
      },
    };
    apiService.post.mockResolvedValue({ data: { data: { id: CASE_ID } } });
  });

  it('omits description on a non-recorte update when the lock is on', async () => {
    kace_data.global_config.behaviors.application.agente.casos.lock_case_description_edit = true;
    storeService.get.mockImplementation((key) =>
      key === 'cases.case_id' ? 'parent-other' : null
    );

    await kace_data._submitCaseData(casePayload(), 'should-not-be-sent');

    const [, payload] = apiService.post.mock.calls[0];
    expect(payload).not.toHaveProperty('description');
    expect(applySaveOutcomeToSnapshot).not.toHaveBeenCalled();
  });

  it('includes description on a non-recorte update when the lock is off', async () => {
    storeService.get.mockImplementation((key) =>
      key === 'cases.case_id' ? 'parent-other' : null
    );

    await kace_data._submitCaseData(casePayload(), 'sent-as-usual');

    const [, payload] = apiService.post.mock.calls[0];
    expect(payload.description).toEqual({
      id: 'd-1',
      descripcion: 'sent-as-usual',
    });
  });

  it('rebases the edit snapshot with the axios response after a recorte save', async () => {
    const response = {
      data: {
        data: {
          warnings: [{ code: CASE_CLIENT_STALE, message: 'stale' }],
        },
      },
    };
    apiService.post.mockResolvedValue(response);
    storeService.get.mockImplementation((key) => {
      if (key === 'cases.case_id') return CASE_ID;
      if (key === 'cases.edit_snapshot') {
        return {
          case: { cliente_id: 'c-load' },
          aux_cases: { data: {} },
          description: '',
        };
      }
      return null;
    });

    await kace_data._submitCaseData(casePayload(), 'desc');

    expect(applySaveOutcomeToSnapshot).toHaveBeenCalledWith(
      storeService,
      expect.objectContaining({
        case: expect.objectContaining({ cliente_id: 'c-1' }),
      }),
      response
    );
  });

  const reclassPayload = () => ({
    case: {
      clasificacion_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      current_clasificacion_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      descripcion_caso_id: 'd-1',
    },
    aux_cases: { caso_id: CASE_ID, data: {} },
  });

  it('attaches comment.descripcion when the payload is a reclassification', async () => {
    storeService.get.mockImplementation((key) => {
      if (key === 'cases.case_id') return 'parent-other';
      if (key === RECLASSIFICATION_REASON_STORE_PATH) {
        return '  Cambio de tipología, no de estado.  ';
      }
      if (key === 'states.current_transition') {
        return { transition_id: 'state-keep' };
      }
      return null;
    });

    await kace_data._submitCaseData(reclassPayload(), 'desc');

    const [, payload] = apiService.post.mock.calls[0];
    expect(payload.comment).toEqual({
      descripcion: 'Cambio de tipología, no de estado.',
    });
    expect(storeService.set).toHaveBeenCalledWith(
      RECLASSIFICATION_REASON_STORE_PATH,
      null
    );
  });

  it('does not POST when the reclassification reason is shorter than 3 characters', async () => {
    storeService.get.mockImplementation((key) => {
      if (key === 'cases.case_id') return 'parent-other';
      if (key === RECLASSIFICATION_REASON_STORE_PATH) return 'ab';
      return null;
    });

    await expect(
      kace_data._submitCaseData(reclassPayload(), 'desc')
    ).rejects.toThrow(/motivo de la reclasificación/i);
    expect(apiService.post).not.toHaveBeenCalled();
    expect(storeService.set).not.toHaveBeenCalledWith(
      RECLASSIFICATION_REASON_STORE_PATH,
      null
    );
  });

  it('keeps the caller case ids when the update fails', async () => {
    apiService.post.mockRejectedValue(new Error('Bad request'));
    storeService.get.mockImplementation((key) =>
      key === 'cases.case_id' ? 'parent-other' : null
    );
    const caseData = {
      case: { id: CASE_ID, descripcion_caso_id: 'd-1' },
      aux_cases: { caso_id: CASE_ID, data: {} },
    };

    await expect(kace_data._submitCaseData(caseData, 'desc')).rejects.toThrow();

    expect(apiService.post.mock.calls[0][1].case.id).toBeUndefined();
    expect(caseData.case.id).toBe(CASE_ID);
    expect(caseData.aux_cases.caso_id).toBe(CASE_ID);
  });

  it('translates a reclassification blocker by its public code when save is rejected', async () => {
    apiService.post.mockRejectedValue({
      response: {
        data: {
          errors: [
            {
              code: '0x030065',
              message: 'The request could not be processed.',
            },
          ],
        },
      },
    });
    storeService.get.mockReturnValue(null);

    await expect(
      kace_data._submitCaseData(casePayload(), 'desc')
    ).rejects.toThrow(
      'Error guardando el caso: Debe indicar el motivo de la reclasificación (mínimo 3 caracteres).'
    );
  });

  it('names the failed transition condition when save is rejected', async () => {
    apiService.post.mockRejectedValue({
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
    });
    storeService.get.mockReturnValue(null);

    await expect(
      kace_data._submitCaseData(casePayload(), 'desc')
    ).rejects.toThrow(
      'Error guardando el caso: No se puede cambiar el estado: el campo «Motivo baja» debe ser «MOTIVO-INEXISTENTE» (actualmente es «MOTIVO-REAL»).'
    );
  });
});

describe('KaceData._caseFieldsValidation transition requirement', () => {
  const editPayloadWithoutTransition = () => ({
    case: {
      cliente_id: 'client-1',
      transicion_id: null,
      clasificacion_id: 'classification-1',
      responsable_id: 'user-1',
      descripcion_caso_id: 'description-1',
      grupo_id: 'group-1',
    },
    aux_cases: { data: {} },
  });

  beforeEach(() => {
    kace_data.case_id = CASE_ID;
    kace_data.current_transition_id = 'state-current';
    kace_data.solved_date = null;
    kace_data.allow_description_empty = true;
    kace_data._schemaValidation = vi.fn().mockResolvedValue();
  });

  it('allows editing without selecting a state when the global setting is disabled', async () => {
    kace_data.case_require_state_change = false;

    await expect(
      kace_data._caseFieldsValidation(
        editPayloadWithoutTransition(),
        'description'
      )
    ).resolves.toBeUndefined();
  });

  it('requires a state during editing when the global setting is enabled', async () => {
    kace_data.case_require_state_change = true;

    await expect(
      kace_data._caseFieldsValidation(
        editPayloadWithoutTransition(),
        'description'
      )
    ).rejects.toThrow('El campo: estados es requerido');
  });

  it('backfills the current transition id when the global setting is disabled and no state was selected', async () => {
    kace_data.case_require_state_change = false;
    const payload = editPayloadWithoutTransition();

    await kace_data._caseFieldsValidation(payload, 'description');

    expect(payload.case.transicion_id).toBe('state-current');
  });

  it('does not override a state the user actually picked', async () => {
    kace_data.case_require_state_change = false;
    const payload = editPayloadWithoutTransition();
    payload.case.transicion_id = 'state-picked';

    await kace_data._caseFieldsValidation(payload, 'description');

    expect(payload.case.transicion_id).toBe('state-picked');
  });
});

describe('KaceData._updateState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kace_data.case_id = CASE_ID;
    kace_data.url_api = 'https://api.example';
    storeService.get.mockReturnValue(null);
  });

  it('explains which transition condition blocked the state change', async () => {
    apiService.post.mockRejectedValue({
      message: 'Request failed with status code 400',
      response: {
        data: {
          errors: [{ code: '0x030004' }],
          data: {
            conditions: {
              combinator: 'and',
              failed: [
                {
                  field: 'cases.grupo_id',
                  operator: '=',
                  expected: 'g-1',
                  expected_label: 'Soporte',
                  actual: 'g-2',
                  actual_label: 'Ventas',
                },
              ],
            },
          },
        },
      },
    });

    await expect(kace_data._updateState('t-1')).rejects.toThrow(
      'Error al actualizar estados: No se puede cambiar el estado: el grupo debe ser «Soporte» (actualmente es «Ventas»).'
    );
  });
});
