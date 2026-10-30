import { production as knexConfig } from '@kace/database/knexfile';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';
import { Controller as Cases2Controller } from '../../kace_cloud_api_cases_2/src/controller.mjs';
import { CaseUpdater } from '@kace/core/src/cases';
import FakeCaseUpdater from '@kace/core/src/fake-cases/application/update/FakeCaseUpdater.js';

const CASE_ID = '55555555-5555-4555-8555-555555555555';

const instantiate = (ControllerClass) => {
    const controller = new ControllerClass(
        createApiEvent({
            body: { case: { alto_impacto: 1 }, aux_cases: {} },
            pathParameters: { id: CASE_ID },
        }),
        knexConfig
    );
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

describe('actionUpdateWithAux does not validate with buildPartial', () => {
    let caseUpdaterSpy;
    let buildPartialSpy;
    let fakeCaseSpy;

    beforeEach(() => {
        caseUpdaterSpy = jest.spyOn(CaseUpdater.prototype, 'execute').mockResolvedValue();
        buildPartialSpy = jest.spyOn(SchemaBuilder, 'buildPartial');
        fakeCaseSpy = jest.spyOn(FakeCaseUpdater.prototype, 'execute').mockResolvedValue();
    });

    afterEach(() => {
        caseUpdaterSpy.mockRestore();
        buildPartialSpy.mockRestore();
        fakeCaseSpy.mockRestore();
    });

    it.each([
        ['cases', Controller],
        ['cases_2', Cases2Controller],
    ])('%s update path never calls SchemaBuilder.buildPartial', async (_label, ControllerClass) => {
        const response = await instantiate(ControllerClass).actionUpdateWithAux();

        expect(response.statusCode).toBe(200);
        expect(caseUpdaterSpy).toHaveBeenCalledTimes(1);
        expect(buildPartialSpy).not.toHaveBeenCalled();
    });
});
