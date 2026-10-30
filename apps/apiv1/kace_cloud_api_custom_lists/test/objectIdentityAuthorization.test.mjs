import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const GROUP_ID = '22222222-2222-4222-8222-222222222222';
const ATTACKER_ID = '99999999-9999-4999-8999-999999999999';

const createConnection = () =>
    jest.fn((table) => {
        expect(table).toBe('grupos');
        return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            modify: jest.fn(function modify(callback) {
                callback?.(this);
                return this;
            }),
            first: jest.fn(async () => ({ id: GROUP_ID })),
        };
    });

describe('Custom lists broad object identity authorization', () => {
    it('uses server-owned create id/audit fields and validates group relationships', async () => {
        const controller = new Controller(
            createApiEvent({
                body: {
                    id: REQUEST_ID,
                    name: 'Regions',
                    is_active: true,
                    aux_entity: 'clients',
                    aux_items: [{ literal: 'North', order: 1 }],
                    groups: [GROUP_ID],
                    created_by: ATTACKER_ID,
                    created_at: '2000-01-01T00:00:00.000Z',
                },
            }),
            knexConfig
        );
        controller.user = createAuthenticatedUser({
            permissions: {
                administrador: [permission('administrador', 'custom-lists', 'CustomListsCreate')],
            },
        });
        controller.started_at = new Date('2026-04-27T12:00:00.000Z');

        let savedPayload;
        controller.repository = {
            table: createConnection(),
            existsByNameAndEntity: jest.fn(async () => false),
            save: jest.fn(async (payload) => {
                savedPayload = payload;
            }),
            destroyConnection: jest.fn(async () => {}),
        };

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(savedPayload.id).toEqual(expect.any(String));
        expect(savedPayload.id).not.toBe(REQUEST_ID);
        expect(savedPayload.created_by).toBe(controller.user.id.value);
        expect(savedPayload.created_at).not.toBe('2000-01-01T00:00:00.000Z');
        expect(savedPayload.groups).toEqual([GROUP_ID]);
        expect(controller.repository.table).toHaveBeenCalledWith('grupos');
    });
});
