import { production as knexConfig } from '@kace/database/knexfile';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { DomainCaseFinder, KnexCaseRepository } from '@kace/core/src/cases';
import { KnexCommentsRepository } from '@kace/core/src/comments';
import { AuxCases, KnexAuxCasesRepository } from '@kace/core/src/aux_casos';
import { KnexAuxDefinitionsRepository } from '@kace/core/src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository';
import { KnexSchemasRepository } from '@kace/core/src/schemas/infrastructure/persistence/KnexSchemasRepository';
import { Schema } from '@kace/core/src/schemas/domain/Schema.js';
import { CaseFolioResolver } from '@kace/core/src/cases/application/folio/CaseFolioResolver.js';
import { Controller } from '../src/controller.mjs';

const ORIGINAL_ID = '11111111-1111-4111-8111-111111111111';
const CLONE_ID = '22222222-2222-4222-8222-222222222222';
const CLONER_ID = '33333333-3333-4333-8333-333333333333';
const AUX_DATA = { form: { field: 'value', document: 'A-1' } };
const SCHEMA_ID = '66666666-6666-4666-8666-666666666666';

const COMMENT_ID = '77777777-7777-4777-8777-777777777777';
const CLASSIFICATION_ID = '88888888-8888-4888-8888-888888888888';

const invoke = async ({ body = { id: CLONE_ID }, originalId = ORIGINAL_ID } = {}) => {
    const event = createApiEvent({ body, pathParameters: { id: originalId } });
    const controller = new Controller(event, knexConfig);
    controller.user = createAuthenticatedUser({
        id: CLONER_ID,
        permissions: { administrador: [permission('administrador', 'cases', 'CaseClone')] },
    });
    const result = await controller.actionUpdate();
    return typeof result.toJson === 'function' ? result.toJson() : result;
};

describe('case-clone actionUpdate — aux_cases', () => {
    let trx;
    let auxSaveSpy;
    let auxHistorySpy;
    let folioSpy;

    beforeEach(() => {
        const cloneCase = {
            id: { value: CLONE_ID },
            clasificacion_id: { value: CLASSIFICATION_ID },
            update: jest.fn(),
            toJson: () => ({ id: CLONE_ID, clasificacion_id: CLASSIFICATION_ID }),
        };
        const originalCase = { id: { value: ORIGINAL_ID }, clone: jest.fn(() => cloneCase) };
        jest.spyOn(DomainCaseFinder.prototype, 'execute').mockImplementation(async (id) =>
            id === ORIGINAL_ID ? originalCase : null
        );
        trx = { commit: jest.fn(), rollback: jest.fn() };
        jest.spyOn(KnexCaseRepository.prototype, 'startTransaction').mockResolvedValue(trx);
        jest.spyOn(KnexCaseRepository.prototype, 'save').mockResolvedValue();
        jest.spyOn(KnexCaseRepository.prototype, 'saveHistory').mockResolvedValue();
        jest.spyOn(KnexAuxCasesRepository.prototype, 'findByCaseId').mockResolvedValue(
            new AuxCases({
                id: '44444444-4444-4444-8444-444444444444',
                caso_id: ORIGINAL_ID,
                data: AUX_DATA,
                created_at: new Date(),
                created_by: '55555555-5555-4555-8555-555555555555',
            })
        );
        jest.spyOn(KnexAuxDefinitionsRepository.prototype, 'findByTableName').mockResolvedValue(null);
        auxSaveSpy = jest.spyOn(KnexAuxCasesRepository.prototype, 'save').mockResolvedValue();
        auxHistorySpy = jest
            .spyOn(KnexAuxCasesRepository.prototype, 'saveHistoryWithRelationships')
            .mockResolvedValue();
        folioSpy = jest.spyOn(CaseFolioResolver.prototype, 'execute').mockResolvedValue(null);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('resuelve el folio del clon con su clasificación, dentro de la transacción del clon', async () => {
        const response = await invoke();

        expect(response.statusCode).toBe(200);
        expect(folioSpy).toHaveBeenCalledWith(
            expect.objectContaining({ classificationId: CLASSIFICATION_ID, auxData: AUX_DATA, trx })
        );
    });

    it('persists a copy of the original aux_cases for the cloned case inside the clone transaction', async () => {
        const response = await invoke();

        expect(response.statusCode).toBe(200);
        expect(KnexAuxCasesRepository.prototype.findByCaseId).toHaveBeenCalledWith(
            expect.objectContaining({ value: ORIGINAL_ID }),
            { trx, forUpdate: true }
        );
        const originalCase = await DomainCaseFinder.prototype.execute(ORIGINAL_ID);
        expect(originalCase.clone).toHaveBeenCalledWith(CLONE_ID, CLONER_ID);
        const [clonedAux, usedTrx] = auxSaveSpy.mock.calls[0];
        expect(clonedAux.caso_id.value).toBe(CLONE_ID);
        expect(clonedAux.data.value).toEqual(AUX_DATA);
        expect(clonedAux.created_by.value).toBe(CLONER_ID);
        expect(usedTrx).toBe(trx);
        expect(auxHistorySpy).toHaveBeenCalledWith(clonedAux, null, clonedAux.caso_id, trx);
        expect(trx.commit).toHaveBeenCalled();
    });

    it('leaves out the values of the unique fields declared in the tenant aux_cases schema', async () => {
        KnexAuxDefinitionsRepository.prototype.findByTableName.mockResolvedValue({ schema_id: { value: SCHEMA_ID } });
        const schema = Schema.create({
            id: SCHEMA_ID,
            name: 'aux_cases_schema',
            created_at: new Date(),
            created_by: CLONER_ID,
            is_active: true,
            data_structure: {
                form: {
                    type: 'object',
                    required: false,
                    data_structure: {
                        field: { type: 'string', required: false },
                        document: { type: 'string', required: false, unique: true },
                    },
                },
            },
        });
        jest.spyOn(KnexSchemasRepository.prototype, 'find').mockResolvedValue(schema);
        jest.spyOn(KnexSchemasRepository.prototype, 'getSchemaRules').mockResolvedValue(schema);

        const response = await invoke();

        expect(response.statusCode).toBe(200);
        expect(KnexAuxDefinitionsRepository.prototype.findByTableName).toHaveBeenCalledWith(
            expect.objectContaining({ value: 'aux_cases' })
        );
        expect(auxSaveSpy.mock.calls[0][0].data.value).toEqual({ form: { field: 'value' } });
    });

    it('rolls back and answers an error when the aux_cases copy fails', async () => {
        // Control flow only: the repositories are mocked. DB atomicity is covered by
        // packages/kace_cloud_core/tests/cases/CaseCloner.test.js against Postgres.
        auxSaveSpy.mockRejectedValue(new Error('aux write failed'));

        const response = await invoke();

        expect(response.statusCode).toBe(500);
        expect(trx.rollback).toHaveBeenCalled();
        expect(trx.commit).not.toHaveBeenCalled();
    });

    it('answers 404 when the original case does not exist', async () => {
        const response = await invoke({ originalId: '88888888-8888-4888-8888-888888888888' });

        expect(response.statusCode).toBe(404);
        expect(KnexCaseRepository.prototype.startTransaction).not.toHaveBeenCalled();
    });

    it('answers 400 when the clone id is already taken', async () => {
        DomainCaseFinder.prototype.execute.mockImplementation(async (id) =>
            id === ORIGINAL_ID || id === CLONE_ID
                ? { id: { value: id }, clone: jest.fn(() => ({ id: { value: CLONE_ID }, update: jest.fn() })) }
                : null
        );

        const response = await invoke();

        expect(response.statusCode).toBe(400);
        expect(KnexCaseRepository.prototype.startTransaction).not.toHaveBeenCalled();
    });

    it('saves the comment on the cloned case inside the clone transaction', async () => {
        jest.spyOn(KnexCommentsRepository.prototype, 'find').mockResolvedValue(null);
        const commentSaveSpy = jest.spyOn(KnexCommentsRepository.prototype, 'save').mockResolvedValue();
        jest.spyOn(KnexCommentsRepository.prototype, 'saveHistory').mockResolvedValue();

        const response = await invoke({
            body: { id: CLONE_ID, comment: { id: COMMENT_ID, descripcion: 'cloned for follow-up' } },
        });

        expect(response.statusCode).toBe(200);
        const [savedComment, usedTrx] = commentSaveSpy.mock.calls[0];
        expect(savedComment.id.value).toBe(COMMENT_ID);
        expect(savedComment.caso_id.value).toBe(CLONE_ID);
        expect(savedComment.created_by.value).toBe(CLONER_ID);
        expect(usedTrx).toBe(trx);
        expect(commentSaveSpy.mock.invocationCallOrder[0]).toBeLessThan(trx.commit.mock.invocationCallOrder[0]);
    });

    it('rolls back the clone when the comment cannot be saved', async () => {
        jest.spyOn(KnexCommentsRepository.prototype, 'find').mockResolvedValue(null);
        jest.spyOn(KnexCommentsRepository.prototype, 'save').mockRejectedValue(new Error('comment write failed'));

        const response = await invoke({
            body: { id: CLONE_ID, comment: { id: COMMENT_ID, descripcion: 'cloned for follow-up' } },
        });

        expect(response.statusCode).toBe(500);
        expect(trx.rollback).toHaveBeenCalled();
        expect(trx.commit).not.toHaveBeenCalled();
    });
});
