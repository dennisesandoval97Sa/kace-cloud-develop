import { production as knexConfig } from '@kace/database/knexfile';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';
import { CaseDescriptionUpdater } from '@kace/core/src/case-descriptions';
import { CaseAuditTouch, CaseUpdater } from '@kace/core/src/cases';

const CASE_ID = '55555555-5555-4555-8555-555555555555';
const DESC_ID = '66666666-6666-4666-8666-666666666666';

const buildGlobalConfig = (lockFlag) => ({
    settings: {
        behaviors: {
            getConfig: () => ({ lock_case_description_edit: lockFlag }),
        },
    },
});

const updatePayload = (overrides = {}) => ({
    case: {},
    aux_cases: {},
    ...overrides,
});

const instantiateController = ({ body, globalConfig } = {}) => {
    const controller = new Controller(createApiEvent({ body, pathParameters: { id: CASE_ID } }), knexConfig);
    controller.user = createAuthenticatedUser({
        permissions: {
            agente: [permission('agente', 'cases', 'CasesUpdate')],
        },
    });
    controller.started_at = new Date('2026-04-23T12:00:00.000Z');
    controller.getGlobalConfig = jest.fn(async () => globalConfig ?? buildGlobalConfig(false));
    controller.fakeCaseUpdaterFactory = () => ({ execute: jest.fn(async () => {}) });
    return controller;
};

describe('actionUpdateWithAux description lock', () => {
    let descriptionUpdaterSpy;
    let caseUpdaterSpy;

    beforeEach(() => {
        descriptionUpdaterSpy = jest.spyOn(CaseDescriptionUpdater.prototype, 'execute').mockResolvedValue();
        caseUpdaterSpy = jest.spyOn(CaseUpdater.prototype, 'execute').mockResolvedValue();
    });

    afterEach(() => {
        descriptionUpdaterSpy.mockRestore();
        caseUpdaterSpy.mockRestore();
    });

    it('returns 400 with 0x030032 when flag is active and payload contains description', async () => {
        const controller = instantiateController({
            body: updatePayload({
                description: { id: DESC_ID, descripcion: 'updated' },
            }),
            globalConfig: buildGlobalConfig(true),
        });

        const response = await controller.actionUpdateWithAux();

        expect(response.statusCode).toBe(400);
        expect(response.publicErrorCode).toBe('0x030032');
        expect(descriptionUpdaterSpy).not.toHaveBeenCalled();
        expect(caseUpdaterSpy).not.toHaveBeenCalled();
    });

    it('updates successfully when flag is active but payload has a domain field and no description', async () => {
        const controller = instantiateController({
            body: updatePayload({
                case: { alto_impacto: 1 },
            }),
            globalConfig: buildGlobalConfig(true),
        });

        const response = await controller.actionUpdateWithAux();

        expect(response.statusCode).toBe(200);
        expect(descriptionUpdaterSpy).not.toHaveBeenCalled();
        expect(caseUpdaterSpy).toHaveBeenCalledTimes(1);
    });

    it('uses the audit-only shortcut when the payload has no domain fields', async () => {
        const auditSpy = jest.spyOn(CaseAuditTouch.prototype, 'execute').mockResolvedValue();
        const controller = instantiateController({
            body: updatePayload(),
            globalConfig: buildGlobalConfig(true),
        });

        const response = await controller.actionUpdateWithAux();

        expect(response.statusCode).toBe(200);
        expect(caseUpdaterSpy).not.toHaveBeenCalled();
        expect(auditSpy).toHaveBeenCalledTimes(1);
        auditSpy.mockRestore();
    });

    it('updates description when flag is inactive and payload contains description', async () => {
        const controller = instantiateController({
            body: updatePayload({
                description: { id: DESC_ID, descripcion: 'updated' },
            }),
            globalConfig: buildGlobalConfig(false),
        });

        const response = await controller.actionUpdateWithAux();

        expect(response.statusCode).toBe(200);
        expect(descriptionUpdaterSpy).toHaveBeenCalledTimes(1);
        expect(caseUpdaterSpy).toHaveBeenCalledTimes(1);
    });
});
