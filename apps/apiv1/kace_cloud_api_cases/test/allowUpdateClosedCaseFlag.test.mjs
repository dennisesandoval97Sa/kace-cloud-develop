import { production as knexConfig } from '@kace/database/knexfile';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';
import { Controller as Cases2Controller } from '../../kace_cloud_api_cases_2/src/controller.mjs';
import { CaseAuditTouch, CaseUpdater } from '@kace/core/src/cases';
import FakeCaseUpdater from '@kace/core/src/fake-cases/application/update/FakeCaseUpdater.js';

const CASE_ID = '55555555-5555-4555-8555-555555555555';

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

describe('ALLOW_UPDATE_CLOSED_CASE gating in actionUpdateWithAux', () => {
    const original = process.env.ALLOW_UPDATE_CLOSED_CASE;
    let caseUpdaterSpy;
    let auditSpy;
    let fakeCaseSpy;

    beforeEach(() => {
        caseUpdaterSpy = jest.spyOn(CaseUpdater.prototype, 'execute').mockResolvedValue();
        auditSpy = jest.spyOn(CaseAuditTouch.prototype, 'execute').mockResolvedValue();
        fakeCaseSpy = jest.spyOn(FakeCaseUpdater.prototype, 'execute').mockResolvedValue();
    });

    afterEach(() => {
        caseUpdaterSpy.mockRestore();
        auditSpy.mockRestore();
        fakeCaseSpy.mockRestore();
        if (original === undefined) {
            delete process.env.ALLOW_UPDATE_CLOSED_CASE;
        } else {
            process.env.ALLOW_UPDATE_CLOSED_CASE = original;
        }
    });

    it.each([
        ['cases', Controller],
        ['cases_2', Cases2Controller],
    ])('%s passes true to CaseUpdater only when the env var is the string true', async (_label, ControllerClass) => {
        process.env.ALLOW_UPDATE_CLOSED_CASE = 'true';

        const response = await instantiate(ControllerClass, {
            case: { alto_impacto: 1 },
            aux_cases: {},
        }).actionUpdateWithAux();

        expect(response.statusCode).toBe(200);
        expect(caseUpdaterSpy).toHaveBeenCalledWith(
            CASE_ID,
            expect.anything(),
            true,
            expect.objectContaining({ allowUpdateClosedCase: true })
        );
    });

    it.each([
        ['unset', undefined],
        ['false', 'false'],
        ['TRUE', 'TRUE'],
        ['1', '1'],
    ])('%s is not treated as enabled', async (_label, value) => {
        if (value === undefined) {
            delete process.env.ALLOW_UPDATE_CLOSED_CASE;
        } else {
            process.env.ALLOW_UPDATE_CLOSED_CASE = value;
        }

        const response = await instantiate(Controller, {
            case: { alto_impacto: 1 },
            aux_cases: {},
        }).actionUpdateWithAux();

        expect(response.statusCode).toBe(200);
        expect(caseUpdaterSpy).toHaveBeenCalledWith(
            CASE_ID,
            expect.anything(),
            true,
            expect.objectContaining({ allowUpdateClosedCase: false })
        );
    });

    it('passes the same flag into the audit-only shortcut', async () => {
        process.env.ALLOW_UPDATE_CLOSED_CASE = 'true';

        const response = await instantiate(Cases2Controller, { case: {}, aux_cases: {} }).actionUpdateWithAux();

        expect(response.statusCode).toBe(200);
        expect(auditSpy).toHaveBeenCalledWith(
            CASE_ID,
            expect.anything(),
            expect.objectContaining({ allowUpdateClosedCase: true })
        );
        expect(caseUpdaterSpy).not.toHaveBeenCalled();
    });
});
