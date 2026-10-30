import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { randomUUID as uuidv4 } from 'node:crypto';

/*
 * Drives the real Controller, ShiftManagementDeleter and ScheduleUsageGuard; only the repository
 * modules are replaced. If the controller stopped wiring the usage guard, deleting a schedule in use
 * would succeed.
 */
const trx = { name: 'schedule-delete-trx' };
const fakeConnection = Object.assign(() => fakeConnection, { client: { config: { client: 'pg' } } });

const shiftManagementRepository = {
    withTransaction: jest.fn(),
    findLocked: jest.fn(),
    update: jest.fn(),
    saveHistory: jest.fn(),
    destroyConnection: jest.fn(),
};
const groupsRepository = { countActiveByHorarioId: jest.fn() };

jest.unstable_mockModule('@kace/core/src/shift-management/infrastructure/KnexShiftManagementRepository.js', () => ({
    KnexShiftManagementRepository: jest.fn(function () {
        Object.assign(this, shiftManagementRepository, { connection: fakeConnection });
    }),
}));
jest.unstable_mockModule('@kace/core/src/grupos/infrastructure/persistence/KnexGroupsRepository.js', () => ({
    KnexGroupsRepository: jest.fn(function () {
        Object.assign(this, groupsRepository, { connection: fakeConnection });
    }),
}));

const { SHIFT_MANAGEMENT_IN_USE_BY_GROUPS } = await import('@kace/error-codes');
const { ShiftManagement } = await import('@kace/core/src/shift-management');
const { Controller } = await import('../src/controller.mjs');

describe('shift-management Controller — schedule usage guard wiring', () => {
    const knexConfig = { client: 'pg', connection: {}, schema: 'tenant' };
    const controllers = [];

    const buildController = (id) => {
        const event = {
            httpMethod: 'GET',
            headers: {},
            pathParameters: { id },
            requestContext: { http: { method: 'GET' } },
            tenantContext: {
                tenant: {
                    aws_cognito_user_pool_id: { value: 'us-east-1_abcd1234' },
                    aws_cognito_app_client_id: { value: 'client123' },
                    id: { value: 'tenant' },
                },
                knexConfig,
                readerConfig: null,
            },
        };
        const controller = new Controller(event, knexConfig);
        Object.defineProperty(controller, 'user', {
            value: { id: { value: uuidv4() }, hasPermission: () => true },
        });
        controllers.push(controller);
        return controller;
    };

    const scheduleWithId = (id) =>
        ShiftManagement.create({
            id,
            description: 'Horario A',
            holiday_dates: [],
            work_days: { monday: { start: '08:00', end: '17:00' } },
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        });

    beforeEach(() => {
        shiftManagementRepository.withTransaction.mockImplementation(async (callback) => callback(trx));
    });

    afterEach(async () => {
        jest.clearAllMocks();
        await Promise.all(controllers.splice(0).map((controller) => controller.destroyDbConnection()));
    });

    it('GET /shift-management/{id}/delete rejects a schedule that groups still use', async () => {
        const id = uuidv4();
        shiftManagementRepository.findLocked.mockResolvedValue(scheduleWithId(id));
        groupsRepository.countActiveByHorarioId.mockResolvedValue(2);

        const response = await buildController(id).actionDelete();

        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.toJson().body).data.code).toBe(SHIFT_MANAGEMENT_IN_USE_BY_GROUPS);
        expect(groupsRepository.countActiveByHorarioId).toHaveBeenCalledWith(id, trx);
        expect(shiftManagementRepository.update).not.toHaveBeenCalled();
    });

    it('GET /shift-management/{id}/delete deletes a schedule no group uses', async () => {
        const id = uuidv4();
        shiftManagementRepository.findLocked.mockResolvedValue(scheduleWithId(id));
        groupsRepository.countActiveByHorarioId.mockResolvedValue(0);

        const response = await buildController(id).actionDelete();

        expect(response.statusCode).toBe(200);
        expect(shiftManagementRepository.update).toHaveBeenCalledTimes(1);
        expect(shiftManagementRepository.update.mock.calls[0][1]).toBe(trx);
    });
});
