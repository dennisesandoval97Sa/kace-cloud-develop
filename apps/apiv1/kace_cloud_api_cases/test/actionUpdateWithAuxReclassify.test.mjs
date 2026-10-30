import { production as knexConfig } from '@kace/database/knexfile';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';
import { Controller as Cases2Controller } from '../../kace_cloud_api_cases_2/src/controller.mjs';
import { KnexRepository } from '@kace/core/src/shared/infrastructure/persistence/KnexRepository.js';
import { CaseReclassifier, CaseUpdater, DomainCaseFinder } from '@kace/core/src/cases';
import { CustomError } from '@kace/core/src/shared/errors/CustomError.js';
import { CASE_RECLASSIFY_CLASSIFICATION_STALE } from '@kace/error-codes';
import FakeCaseUpdater from '@kace/core/src/fake-cases/application/update/FakeCaseUpdater.js';
import { AuxCasesUpdater } from '@kace/core/src/aux_casos/application/update/AuxCasesUpdater.js';

const CASE_ID = '55555555-5555-4555-8555-555555555555';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const T = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const COMMENT = { descripcion: 'Cambio de tipología, no de estado.' };

const instantiate = (ControllerClass, body) => {
    const controller = new ControllerClass(createApiEvent({ body, pathParameters: { id: CASE_ID } }), knexConfig);
    controller.user = createAuthenticatedUser({
        permissions: {
            agente: [permission('agente', 'cases', 'CasesUpdate')],
        },
    });
    controller.started_at = new Date('2026-04-23T12:00:00.000Z');
    controller.getGlobalConfig = jest.fn(async () => ({
        settings: { behaviors: { getConfig: () => ({}) } },
    }));
    return controller;
};

const intentBody = (extra = {}) => ({
    case: { clasificacion_id: C, current_clasificacion_id: A },
    aux_cases: {},
    ...extra,
});

const reclassBody = () => ({
    case: { clasificacion_id: C, current_clasificacion_id: A, transicion_id: T },
    aux_cases: {},
    comment: COMMENT,
});

const invoke = async (ControllerClass, body) => {
    const result = await instantiate(ControllerClass, body).actionUpdateWithAux();
    return typeof result.toJson === 'function' ? result.toJson() : result;
};

describe('actionUpdateWithAux reclassification', () => {
    let reclassifierSpy;
    let caseUpdaterSpy;
    let fakeCaseSpy;
    let finderSpy;
    let auxSpy;
    let relationshipSpy;
    let previousAppsDebug;

    beforeEach(() => {
        previousAppsDebug = process.env.APPS_DEBUG;
        process.env.APPS_DEBUG = 'true';
        reclassifierSpy = jest.spyOn(CaseReclassifier.prototype, 'execute').mockResolvedValue({});
        caseUpdaterSpy = jest.spyOn(CaseUpdater.prototype, 'execute').mockResolvedValue({});
        fakeCaseSpy = jest.spyOn(FakeCaseUpdater.prototype, 'execute').mockResolvedValue();
        finderSpy = jest.spyOn(DomainCaseFinder.prototype, 'execute').mockResolvedValue({
            clasificacion_id: { value: A },
        });
        auxSpy = jest.spyOn(AuxCasesUpdater.prototype, 'execute').mockResolvedValue();
        const query = {
            select() {
                return this;
            },
            where() {
                return this;
            },
            whereNull() {
                return this;
            },
            andWhere() {
                return this;
            },
            modify(fn) {
                fn(this);
                return this;
            },
            first: async () => ({ id: 'present' }),
        };
        relationshipSpy = jest.spyOn(KnexRepository.prototype, 'table').mockImplementation(() => query);
    });

    afterEach(() => {
        if (previousAppsDebug === undefined) {
            delete process.env.APPS_DEBUG;
        } else {
            process.env.APPS_DEBUG = previousAppsDebug;
        }
        reclassifierSpy.mockRestore();
        caseUpdaterSpy.mockRestore();
        fakeCaseSpy.mockRestore();
        finderSpy.mockRestore();
        auxSpy.mockRestore();
        relationshipSpy.mockRestore();
    });

    it.each([
        ['cases', Controller],
        ['cases_2', Cases2Controller],
    ])('%s returns 400 and does not touch aux when intent has no comment', async (_label, ControllerClass) => {
        const response = await instantiate(ControllerClass, intentBody()).actionUpdateWithAux();

        expect(response.statusCode).toBe(400);
        expect(reclassifierSpy).not.toHaveBeenCalled();
        expect(auxSpy).not.toHaveBeenCalled();
        expect(caseUpdaterSpy).not.toHaveBeenCalled();
    });

    it.each([
        ['cases', Controller],
        ['cases_2', Cases2Controller],
    ])('%s reclassifies then updates without clasificacion_id', async (_label, ControllerClass) => {
        const response = await invoke(ControllerClass, reclassBody());

        expect(response.statusCode).toBe(200);
        expect(reclassifierSpy).toHaveBeenCalledWith(
            CASE_ID,
            expect.objectContaining({ clasificacion_id: C, transicion_id: T }),
            expect.objectContaining({
                clasificacionSnapshot: A,
                comment: COMMENT,
            })
        );
        expect(caseUpdaterSpy).toHaveBeenCalled();
        const updaterDto = caseUpdaterSpy.mock.calls[0][1];
        expect(updaterDto.clasificacion_id).toBeUndefined();
        expect(updaterDto.current_clasificacion_id).toBeUndefined();
    });

    it('returns 400 when intent has a comment but no transicion_id', async () => {
        const response = await instantiate(Controller, intentBody({ comment: COMMENT })).actionUpdateWithAux();

        expect(response.statusCode).toBe(400);
        expect(reclassifierSpy).not.toHaveBeenCalled();
        expect(auxSpy).not.toHaveBeenCalled();
    });

    it('does not reclassify when destino equals persistida (strips clasificacion_id)', async () => {
        finderSpy.mockResolvedValue({ clasificacion_id: { value: A } });

        const response = await invoke(Controller, {
            case: { clasificacion_id: A, current_clasificacion_id: A },
            aux_cases: {},
        });

        expect(response.statusCode).toBe(200);
        expect(reclassifierSpy).not.toHaveBeenCalled();
        expect(finderSpy).toHaveBeenCalled();
        expect(caseUpdaterSpy).toHaveBeenCalled();
        const updaterDto = caseUpdaterSpy.mock.calls[0][1];
        expect(updaterDto.clasificacion_id).toBeUndefined();
    });

    it('reclassifies when current_* is omitted and persistida differs', async () => {
        const response = await invoke(Controller, {
            case: { clasificacion_id: C, transicion_id: T },
            aux_cases: {},
            comment: COMMENT,
        });

        expect(response.statusCode).toBe(200);
        expect(finderSpy).toHaveBeenCalled();
        expect(reclassifierSpy).toHaveBeenCalledWith(
            CASE_ID,
            expect.objectContaining({ clasificacion_id: C, transicion_id: T }),
            expect.objectContaining({ clasificacionSnapshot: A, comment: COMMENT })
        );
    });

    it('reclassifies with the form snapshot when persistida moved to B', async () => {
        const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
        finderSpy.mockResolvedValue({ clasificacion_id: { value: B } });

        const response = await invoke(Controller, reclassBody());

        expect(response.statusCode).toBe(200);
        expect(finderSpy).toHaveBeenCalled();
        expect(reclassifierSpy).toHaveBeenCalledWith(
            CASE_ID,
            expect.objectContaining({ clasificacion_id: C }),
            expect.objectContaining({ clasificacionSnapshot: A })
        );
        expect(caseUpdaterSpy.mock.calls[0][3]).toEqual(
            expect.objectContaining({ requiredPermission: expect.objectContaining({ name: 'CaseReclassify' }) })
        );
    });

    it('does not reclassify or require comment when destino is already persisted', async () => {
        finderSpy.mockResolvedValue({ clasificacion_id: { value: C } });

        const response = await invoke(Controller, intentBody());

        expect(response.statusCode).toBe(200);
        expect(reclassifierSpy).not.toHaveBeenCalled();
        expect(caseUpdaterSpy).toHaveBeenCalled();
    });

    it('maps CaseReclassifier 409 to HTTP 409, not 500', async () => {
        reclassifierSpy.mockRejectedValue(
            new CustomError(
                'The case classification changed after the form was loaded; reload the case before reclassifying.',
                409,
                [],
                CASE_RECLASSIFY_CLASSIFICATION_STALE
            )
        );

        const response = await instantiate(Controller, reclassBody()).actionUpdateWithAux();

        expect(response.statusCode).toBe(409);
        expect(response.publicErrorCode).toBe(CASE_RECLASSIFY_CLASSIFICATION_STALE);
        expect(auxSpy).not.toHaveBeenCalled();
    });
});
