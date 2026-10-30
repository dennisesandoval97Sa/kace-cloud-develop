import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';

const REQUEST_ID = '11111111-2222-4333-8444-555555555555';
const DRAFT_ID = '66666666-7777-4888-8999-aaaaaaaaaaaa';

const grantCreate = () => ({
    agente: [permission('agente', 'cases', 'CasesCreate')],
});

const createRelationshipConnection = () => () => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    first: jest.fn(async () => ({ id: 'related-row' })),
});

describe('Temp cases object identity authorization', () => {
    it('replaces request-body ids on temp case create and returns the generated id', async () => {
        let createdValue;
        const controller = new Controller(
            createApiEvent({
                body: {
                    id: REQUEST_ID,
                    cliente_id: null,
                    transicion_id: null,
                    responsable_id: null,
                    clasificacion_id: null,
                    grupo_id: null,
                },
            }),
            knexConfig
        );
        controller.user = createAuthenticatedUser({ permissions: grantCreate() });
        controller.repository = {
            connection: createRelationshipConnection(),
        };
        controller.fakeCaseCreatorFactory = () => ({
            execute: jest.fn(async (value) => {
                createdValue = value;
                return { toJson: () => ({ data: { id: value.id } }) };
            }),
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(createdValue.id).toEqual(expect.any(String));
        expect(createdValue.id).not.toBe(REQUEST_ID);
        expect(response.data.id).toBe(createdValue.id);
    });

    it('updates temp case drafts by path id only after ownership authorization', async () => {
        const controller = new Controller(
            createApiEvent({
                pathParameters: { id: DRAFT_ID },
                body: {
                    cliente_id: null,
                    transicion_id: null,
                    responsable_id: null,
                    clasificacion_id: null,
                    grupo_id: null,
                },
            }),
            knexConfig
        );
        controller.user = createAuthenticatedUser({ permissions: grantCreate() });
        const updateExecute = jest.fn(async () => {});
        controller.fakeCaseUpdaterFactory = () => ({ execute: updateExecute });
        controller.repository = {
            connection: createRelationshipConnection(),
            find: jest.fn(async () => ({ id: { value: DRAFT_ID }, created_by: { value: controller.user.id.value } })),
        };

        const response = await controller.actionUpdate();

        expect(response.statusCode).toBe(200);
        expect(updateExecute).toHaveBeenCalledWith(DRAFT_ID, expect.any(Object));
    });
});
