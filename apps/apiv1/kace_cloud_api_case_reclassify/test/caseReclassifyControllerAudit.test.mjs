import { describe, expect, it, jest } from '@jest/globals';
import { production as knexConfig } from '@kace/database/knexfile';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { CASE_RECLASSIFY_DISABLED } from '@kace/error-codes';
import { Case } from '@kace/core/src/cases';
import { Controller } from '../src/controller.mjs';

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const CLASSIFICATION_ID = '22222222-2222-4222-8222-222222222222';
const TRANSITION_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const FLOW_ID = '44444444-4444-4444-8444-444444444444';

/**
 * `CaseReclassifier` valida la elegibilidad antes de escribir. Estos stubs la dejan pasar para que
 * el test siga midiendo lo suyo: que el `CaseUpdater` real estampe `edited_by` y `edited_at`.
 */
const wireEligibilityStubs = (controller, { allowCaseReclassification = true } = {}) => {
    controller.getGlobalConfig = jest.fn(async () => ({
        settings: { behaviors: { getConfig: () => ({ allow_case_reclassification: allowCaseReclassification }) } },
    }));
    controller.classificationsRepository = {
        find: jest.fn(async () => ({
            id: { value: CLASSIFICATION_ID },
            is_active: { value: true },
            flujo_id: { value: FLOW_ID },
        })),
    };
    controller.classificationGroupRelationshipRepository = {
        find: jest.fn(async () => ({ form: { value: '77777777-7777-4777-8777-777777777777' } })),
    };
    controller.transitionsCaseRepository = {
        findById: jest.fn(async () => ({ flujo_id: FLOW_ID })),
    };
    controller.subcaseRelationshipRepository = {
        findParentCaseId: jest.fn(async () => null),
        findOpenChildClassificationIds: jest.fn(async () => []),
    };
    // Folio configurable: la clasificación destino no tiene configuración, así que no asigna folio.
    controller.caseFolioResolver = { execute: jest.fn(async () => null) };
    controller.auxCasesFinderByCase = { execute: jest.fn(async () => null) };
};

const createCaseFixture = ({ responsableId = OTHER_USER_ID } = {}) =>
    new Case({
        id: CASE_ID,
        cliente_id: '12121212-1212-4212-8212-121212121212',
        transicion_id: '13131313-1313-4313-8313-131313131313',
        responsable_id: responsableId,
        clasificacion_id: '14141414-1414-4414-8414-141414141414',
        descripcion_caso_id: '15151515-1515-4515-8515-151515151515',
        grupo_id: '16161616-1616-4616-8616-161616161616',
        created_at: new Date().toISOString(),
        created_by: OTHER_USER_ID,
    });

describe('CaseReclassify Controller - Integration with real CaseUpdater', () => {
    it('allows a non-owner user with CaseReclassify permission to reclassify a case and persists edited_by and edited_at', async () => {
        const kase = createCaseFixture({ responsableId: OTHER_USER_ID });
        let updatedCaseInstance = null;

        const queryBuilder = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn(async () => ({ id: '00000000-0000-4000-8000-000000000000' })),
            insert: jest.fn(async () => {}),
        };

        const mockRepository = {
            connection: jest.fn(() => queryBuilder),
            qualifiedName: (table) => table,
            find: jest.fn(async () => kase),
            update: jest.fn(async (updatedCase) => {
                updatedCaseInstance = updatedCase;
            }),
            saveHistory: jest.fn(async () => {}),
            findByIdForAns: jest.fn(async () => null),
            // La reclasificación escribe `clasificacion_id` con bloqueo optimista, no por el dto:
            // sin esto el doble no cubre el contrato que `CaseUpdater` ejercita en esta ruta.
            updateColumnIfSnapshotMatches: jest.fn(async () => true),
        };

        const body = {
            clasificacion_id: CLASSIFICATION_ID,
            transicion_id: TRANSITION_ID,
            edited_by: '00000000-0000-0000-0000-000000000001',
            edited_at: '2020-01-01T00:00:00.000Z',
            // El servidor pone id, fecha y autor del motivo: el cliente solo manda la descripción.
            comment: {
                descripcion: 'Reclassification note',
            },
        };

        const event = createApiEvent({ body, pathParameters: { id: CASE_ID } });
        const controller = new Controller(event, knexConfig);
        // User has only CaseReclassify, is NOT the owner (OTHER_USER_ID), and lacks CaseUpdateNotOwner
        controller.user = createAuthenticatedUser({
            permissions: {
                administrador: [permission('administrador', 'cases', 'CaseReclassify')],
            },
        });
        controller.repository = mockRepository;
        controller.actionExecutionService = null;
        controller.transitionRuleRepository = null;
        controller.commentsRepository = {
            find: jest.fn(async () => null),
            save: jest.fn(async () => {}),
            saveHistory: jest.fn(async () => {}),
        };
        wireEligibilityStubs(controller);

        const response = await controller.actionUpdate();

        // 200: CaseReclassify es su propio permiso y no exige ser responsable ni CaseUpdateNotOwner.
        expect(response.statusCode).toBe(200);

        // Verify that real CaseUpdater updated the domain Case with server-set audit fields
        expect(updatedCaseInstance).not.toBeNull();
        expect(updatedCaseInstance.clasificacion_id.value).toBe(CLASSIFICATION_ID);
        expect(updatedCaseInstance.transicion_id.value).toBe(TRANSITION_ID);
        expect(updatedCaseInstance.cambio_clasificacion.value).toBe(true);

        // Server-managed edited_by and edited_at match authenticated user and started_at
        expect(updatedCaseInstance.edited_by.value).toBe(controller.user.id.value);
        expect(updatedCaseInstance.edited_at.value).toBe(controller.started_at.toISOString());
    });

    it('does not set edited_by or edited_at on domain Case when executed by a service account', async () => {
        const kase = createCaseFixture({ responsableId: OTHER_USER_ID });
        let updatedCaseInstance = null;

        const queryBuilder = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn(async () => ({ id: '00000000-0000-4000-8000-000000000000' })),
            insert: jest.fn(async () => {}),
        };

        const mockRepository = {
            connection: jest.fn(() => queryBuilder),
            qualifiedName: (table) => table,
            find: jest.fn(async () => kase),
            update: jest.fn(async (updatedCase) => {
                updatedCaseInstance = updatedCase;
            }),
            saveHistory: jest.fn(async () => {}),
            findByIdForAns: jest.fn(async () => null),
            // La reclasificación escribe `clasificacion_id` con bloqueo optimista, no por el dto:
            // sin esto el doble no cubre el contrato que `CaseUpdater` ejercita en esta ruta.
            updateColumnIfSnapshotMatches: jest.fn(async () => true),
        };

        const body = {
            clasificacion_id: CLASSIFICATION_ID,
            transicion_id: TRANSITION_ID,
            comment: {
                descripcion: 'Reclassification note',
            },
        };

        const event = createApiEvent({ body, pathParameters: { id: CASE_ID } });
        const controller = new Controller(event, knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: {
                administrador: [permission('administrador', 'cases', 'CaseReclassify')],
            },
        });
        controller.user.account_type = 2; // Service account
        controller.repository = mockRepository;
        controller.actionExecutionService = null;
        controller.transitionRuleRepository = null;
        controller.commentsRepository = {
            find: jest.fn(async () => null),
            save: jest.fn(async () => {}),
            saveHistory: jest.fn(async () => {}),
        };
        wireEligibilityStubs(controller);

        const response = await controller.actionUpdate();

        expect(response.statusCode).toBe(200);
        expect(updatedCaseInstance).not.toBeNull();
        expect(updatedCaseInstance.clasificacion_id.value).toBe(CLASSIFICATION_ID);
        expect(updatedCaseInstance.transicion_id.value).toBe(TRANSITION_ID);
        expect(updatedCaseInstance.edited_by?.value).toBeFalsy();
        expect(updatedCaseInstance.edited_at?.value).toBeFalsy();
    });

    it('rejects with 403 and writes nothing when allow_case_reclassification is off, even with CaseReclassify', async () => {
        const mockRepository = {
            connection: jest.fn(),
            qualifiedName: (table) => table,
            find: jest.fn(async () => createCaseFixture()),
            update: jest.fn(async () => {}),
        };
        const event = createApiEvent({
            body: {
                clasificacion_id: CLASSIFICATION_ID,
                transicion_id: TRANSITION_ID,
                comment: { descripcion: 'Reclassification note' },
            },
            pathParameters: { id: CASE_ID },
        });
        const controller = new Controller(event, knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: {
                agente: [permission('agente', 'cases', 'CaseReclassify')],
            },
        });
        controller.repository = mockRepository;
        wireEligibilityStubs(controller, { allowCaseReclassification: false });

        const response = await controller.actionUpdate();

        expect(response.statusCode).toBe(403);
        expect(response.publicErrorCode).toBe(CASE_RECLASSIFY_DISABLED);
        expect(mockRepository.update).not.toHaveBeenCalled();
    });
});
