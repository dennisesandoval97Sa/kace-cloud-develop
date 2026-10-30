import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { randomUUID as uuidv4 } from 'node:crypto';

/*
 * Drives the real Controller, use cases and GroupScheduleGuard; only the repository modules are
 * replaced. If the controller stopped injecting the guard into a use case, these requests would succeed.
 */
const trx = { name: 'group-save-trx' };
const fakeConnection = Object.assign(() => fakeConnection, { client: { config: { client: 'pg' } } });

const groupsRepository = {
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    saveHistory: jest.fn(),
    withTransaction: jest.fn(),
    table: jest.fn(),
    destroyConnection: jest.fn(),
};
const shiftManagementRepository = { find: jest.fn(), findLocked: jest.fn(), destroyConnection: jest.fn() };

jest.unstable_mockModule('@kace/core/src/grupos/infrastructure/persistence/KnexGroupsRepository.js', () => ({
    KnexGroupsRepository: jest.fn(function () {
        Object.assign(this, groupsRepository, { connection: fakeConnection });
    }),
}));
jest.unstable_mockModule('@kace/core/src/shift-management/infrastructure/KnexShiftManagementRepository.js', () => ({
    KnexShiftManagementRepository: jest.fn(function () {
        Object.assign(this, shiftManagementRepository, { connection: fakeConnection });
    }),
}));

const { GROUP_SCHEDULE_UNAVAILABLE } = await import('@kace/error-codes');
const { GroupFinder, Groups } = await import('@kace/core/src/grupos');
const { ShiftManagement } = await import('@kace/core/src/shift-management');
const { UserFinder } = await import('@kace/core/src/users/index.js');
const { GlobalConfigFinder } = await import('@kace/core/src/global-config');
const { UniquenessValidator } = await import('@kace/core/src/shared/index.js');
const { Controller } = await import('../src/Controller.mjs');

describe('group Controller — schedule guard wiring', () => {
    const knexConfig = { client: 'pg', connection: {}, schema: 'tenant' };
    const controllers = [];

    const buildGroup = () =>
        Groups.create({
            id: uuidv4(),
            nombre: 'Soporte',
            horario_id: uuidv4(),
            descripcion: 'Grupo de soporte',
            codigo_externo: 'SOP',
            status: 1,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        });

    const deletedSchedule = (id) => {
        const schedule = ShiftManagement.create({
            id,
            description: 'Horario A',
            holiday_dates: [],
            work_days: { monday: { start: '08:00', end: '17:00' } },
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        });
        schedule.delete({ deleted_at: new Date().toISOString(), deleted_by: uuidv4() });
        return schedule;
    };

    const buildController = ({ body, id } = {}) => {
        const event = {
            httpMethod: 'POST',
            headers: {},
            body: body ? JSON.stringify(body) : undefined,
            pathParameters: id ? { id } : undefined,
            requestContext: { http: { method: 'POST' } },
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
            value: { id: { value: uuidv4() }, grupo_activo: { value: null }, hasPermission: () => true },
        });
        controllers.push(controller);
        return controller;
    };

    const expectScheduleUnavailable = (response) => {
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.toJson().body).data.code).toBe(GROUP_SCHEDULE_UNAVAILABLE);
    };

    beforeEach(() => {
        groupsRepository.withTransaction.mockImplementation(async (callback) => callback(trx));
        groupsRepository.find.mockResolvedValue(null);
        jest.spyOn(UserFinder.prototype, 'execute').mockResolvedValue({
            toJson: () => ({ data: { grupo_activo: null } }),
        });
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        await Promise.all(controllers.splice(0).map((controller) => controller.destroyDbConnection()));
    });

    it('POST /groups rejects a deleted schedule through the guard, inside the save transaction', async () => {
        const horarioId = uuidv4();
        shiftManagementRepository.findLocked.mockResolvedValue(deletedSchedule(horarioId));
        // The create relationship check only proves the row exists; it does not filter deleted schedules.
        groupsRepository.table.mockImplementation(() => {
            const builder = {
                select: () => builder,
                where: () => builder,
                modify: () => builder,
                first: async () => ({ id: horarioId }),
            };
            return builder;
        });
        jest.spyOn(GroupFinder.prototype, 'execute').mockResolvedValue({
            toJson: () => ({ data: { configuration_id: null } }),
        });
        jest.spyOn(GlobalConfigFinder.prototype, 'getConfiguration').mockResolvedValue({});
        jest.spyOn(UniquenessValidator.prototype, 'validate').mockResolvedValue(undefined);

        const response = await buildController({
            body: { id: uuidv4(), nombre: 'Soporte', horario_id: horarioId, status: 1 },
        }).actionCreate();

        expectScheduleUnavailable(response);
        expect(shiftManagementRepository.findLocked).toHaveBeenCalledTimes(1);
        const [scheduleId, usedTrx] = shiftManagementRepository.findLocked.mock.calls[0];
        expect(scheduleId.value).toBe(horarioId);
        expect(usedTrx).toBe(trx);
        expect(groupsRepository.save).not.toHaveBeenCalled();
    });

    it('POST /groups/{id} rejects a new schedule that was deleted', async () => {
        const group = buildGroup();
        const horarioId = uuidv4();
        shiftManagementRepository.findLocked.mockResolvedValue(deletedSchedule(horarioId));
        groupsRepository.find.mockResolvedValue(group);

        const response = await buildController({ id: group.id.value, body: { horario_id: horarioId } }).actionUpdate();

        expectScheduleUnavailable(response);
        expect(groupsRepository.update).not.toHaveBeenCalled();
    });

    it('POST /groups/{id} answers the null horario_id of the detail with GROUP_SCHEDULE_UNAVAILABLE', async () => {
        const group = buildGroup();
        groupsRepository.find.mockResolvedValue(group);

        const response = await buildController({
            id: group.id.value,
            body: { horario_id: null, descripcion: 'Nueva descripcion' },
        }).actionUpdate();

        expectScheduleUnavailable(response);
        expect(shiftManagementRepository.findLocked).not.toHaveBeenCalled();
        expect(groupsRepository.update).not.toHaveBeenCalled();
    });

    it('GET /groups/{id} returns horario_id null when the saved schedule was deleted', async () => {
        const group = buildGroup();
        groupsRepository.find.mockResolvedValue(group);
        shiftManagementRepository.find.mockResolvedValue(deletedSchedule(group.horario_id.value));

        const response = await buildController({ id: group.id.value }).actionRead();

        expect(response.statusCode).toBe(200);
        expect(shiftManagementRepository.find.mock.calls[0][0].value).toBe(group.horario_id.value);
        const { data } = JSON.parse(response.toJson().body);
        expect(data.data).toMatchObject({ id: group.id.value, horario_id: null, horario_description: '' });
        expect(data.horario_description).toBe('');
    });

    // Response maps the CustomError 404 that GroupFinder throws to its status code.
    it('GET /groups/{id} answers 404 for a group that does not exist', async () => {
        const response = await buildController({ id: uuidv4() }).actionRead();

        expect(response.statusCode).toBe(404);
        expect(shiftManagementRepository.find).not.toHaveBeenCalled();
    });
});
