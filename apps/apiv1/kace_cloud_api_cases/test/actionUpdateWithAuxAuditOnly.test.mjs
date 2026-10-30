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

const CASE_ID = '55555555-5555-4555-8555-555555555555';

const instantiate = (ControllerClass, body = { case: {}, aux_cases: {} }) => {
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

describe('actionUpdateWithAux audit-only shortcut', () => {
    let auditSpy;
    let caseUpdaterSpy;

    beforeEach(() => {
        auditSpy = jest.spyOn(CaseAuditTouch.prototype, 'execute').mockResolvedValue();
        caseUpdaterSpy = jest.spyOn(CaseUpdater.prototype, 'execute').mockResolvedValue();
    });

    afterEach(() => {
        auditSpy.mockRestore();
        caseUpdaterSpy.mockRestore();
    });

    it.each([
        ['cases', Controller],
        ['cases_2', Cases2Controller],
    ])('%s routes an empty payload through CaseAuditTouch', async (_label, ControllerClass) => {
        const response = await instantiate(ControllerClass).actionUpdateWithAux();

        expect(response.statusCode).toBe(200);
        expect(auditSpy).toHaveBeenCalledTimes(1);
        expect(caseUpdaterSpy).not.toHaveBeenCalled();
    });
});
