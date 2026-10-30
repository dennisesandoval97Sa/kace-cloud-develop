import { production as knexConfig } from '@kace/database/knexfile';
import { jest, describe, it, expect, afterEach } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';
import { Controller as Cases2Controller } from '../../kace_cloud_api_cases_2/src/controller.mjs';
import { TransitionRuleValidator } from '@kace/core/src/transition-rules/domain/TransitionRuleValidator.js';
import { TransitionConditionsNotMetError } from '@kace/core/src/transition-rules/domain/TransitionConditionsNotMetError.js';

const CASE_ID = '55555555-5555-4555-8555-555555555555';
const TRANSITION_ID = '66666666-6666-4666-8666-666666666666';
const DIAGNOSTIC = {
    combinator: 'and',
    failed: [{ field: 'cases.motivo_baja', operator: '=', expected: 'A', actual: 'B' }],
};

const instantiate = (ControllerClass) => {
    const controller = new ControllerClass(
        createApiEvent({
            body: { case: { transicion_id: TRANSITION_ID }, aux_cases: {} },
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
    return controller;
};

describe('actionUpdateWithAux rejected by transition conditions', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each([
        ['cases', Controller],
        ['cases_2', Cases2Controller],
    ])('%s keeps the public code and the failed conditions', async (_label, ControllerClass) => {
        jest.spyOn(TransitionRuleValidator, 'enforceRuleForTransitionWithMergedContext').mockRejectedValue(
            new TransitionConditionsNotMetError(DIAGNOSTIC)
        );

        const response = await instantiate(ControllerClass).actionUpdateWithAux();
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(400);
        expect(body.data).toMatchObject({ code: '0x030004', conditions: DIAGNOSTIC });
        expect(body.errors[0].code).toBe('0x030004');
    });
});
