import { production as knexConfig } from '@kace/database/knexfile';
import { KnexAppointmentRepository } from '@kace/core/src/appointments/infrastructure/persistence/KnexAppointmentRepository.js';
import { KnexUsersRepository } from '@kace/core/src/users';
import { KnexAgendaRepository } from '@kace/core/src/agendas/infrastructure/persistence/KnexAgendaRepository.js';
import { KnexOneScriptRepository } from '@kace/core/src/one-script';
import { KnexAgendasGroupsRepository } from '@kace/core/src/agendas-groups/infrastructure/persistence/KnexAgendasGroupsRepository.js';
import { KnexAppointmentTimeSlotsRepository } from '@kace/core/src/appointment-time-slots/infraestructure/persistence/KnexAppointmentTimeSlots.js';
import { KnexGroupsRepository } from '@kace/core/src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import { KnexShiftManagementRepository } from '@kace/core/src/shift-management/';
import { KnexPoliciesRepository } from '@kace/core/src/policies/infrastructure/persistence/KnexPoliciesRepository.js';
import { AppointmentsMother } from '@kace/core/tests/appointments/domain/AppointmentsMother.js';
import { CaseFactory } from '@kace/core/src/factories/CaseFactory.js';
import { GroupsMother } from '@kace/core/tests/groups/domain/GroupsMother.js';
import { AgendasMother } from '@kace/core/tests/agendas/domain/AgendasMother.js';
import { AgendasGroupsMother } from '@kace/core/tests/agendas-groups/domain/AgendasGroupsMother.js';
import ShiftManagementMother from '@kace/core/tests/shift-management/domain/ShiftManagementMother.js';
import { AppointmentTimeSlotsMother } from '@kace/core/tests/appointment-time-slots/domain/AppointmentTimeSlotsMother.js';
import RoleMother from '@kace/core/tests/roles/domain/RoleMother';
import { PoliciesMother } from '@kace/core/tests/policies/domain/PoliciesMother';
import UsersMother from '@kace/core/tests/users/domain/UsersMother.js';
import OneScriptMother from '@kace/core/tests/one-script/domain/OneScriptMother.js';
import { KnexRoleRepository } from '@kace/core/src/role/infrastructure/persistence/KnexRoleRepository.js';
import { TestHelper } from '@kace/api-common';
import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';
import { VALIDATION_ERROR } from '@kace/error-codes';

const appointmentRepository = new KnexAppointmentRepository(knexConfig);
const userRepository = new KnexUsersRepository(appointmentRepository.connection);
const agendaRepository = new KnexAgendaRepository(appointmentRepository.connection);
const oneScriptRepository = new KnexOneScriptRepository(appointmentRepository.connection);
const agendasGroupsRepository = new KnexAgendasGroupsRepository(appointmentRepository.connection);
const appointmentTimeSlotsRepository = new KnexAppointmentTimeSlotsRepository(appointmentRepository.connection);
const groupsRepository = new KnexGroupsRepository(appointmentRepository.connection);
const shiftManagementRepository = new KnexShiftManagementRepository(appointmentRepository.connection);
const politicRepository = new KnexPoliciesRepository(appointmentRepository.connection);
const roleRepository = new KnexRoleRepository(appointmentRepository.connection);

const baseUrl =
    process.env.APPS_ENVIRONMENT === 'staging'
        ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/appointments`
        : `http://127.0.0.1:60073`;

const messages = {
    INVALID_ID: 'Invalid id',
    NOT_FOUND: 'Not found',
    VALIDATIONS_FAIL: 'Validations fail',
    SUCCESS: 'Success',
    NOT_MATCH_ANY_TIME_SLOT: 'The selected date and time do not match any available time slot',
};

const UUID_FALSE = uuidv4();

const createTimeSlotData = (overrides = {}) => {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const date = now.toISOString().split('T')[0];

    const defaults = {
        timeSlotStart: '14:00',
        timeSlotEnd: '15:00',
        date,
        startTime: `${date}T14:00:00.000Z`,
        endTime: `${date}T15:00:00.000Z`,
    };

    return { ...defaults, ...overrides };
};

const createShiftManagementData = () => ({
    holiday_dates: [
        '2025-01-01',
        '2025-01-06',
        '2025-03-24',
        '2025-04-13',
        '2025-04-14',
        '2025-05-01',
        '2025-05-19',
        '2025-06-09',
        '2025-06-16',
        '2025-07-07',
        '2025-07-20',
        '2025-08-07',
        '2025-08-18',
        '2025-10-13',
        '2025-11-03',
        '2025-11-17',
        '2025-12-08',
        '2025-12-25',
    ],
    work_days: {
        monday: { start: '08:00', end: '16:00' },
        tuesday: { start: '08:00', end: '16:00' },
        wednesday: { start: '08:00', end: '16:00' },
        thursday: { start: '08:00', end: '16:00' },
        friday: { start: '08:00', end: '16:00' },
    },
});

const prepareAppointmentTestData = async (overrides = {}) => {
    const { user } = await createUserWithRoleAndPolicy(politicRepository, roleRepository, userRepository);
    const caso = await CaseFactory.create();
    const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);
    const agenda = await AgendasMother.create(agendaRepository, oneScript.id.value);
    const role = await RoleMother.createRandomRole(roleRepository);

    const shiftManagementData = createShiftManagementData();
    const shift = await ShiftManagementMother.createShiftManagement(shiftManagementRepository, shiftManagementData);

    const group = await GroupsMother.createRandomGroup(groupsRepository, role.id.value);
    await groupsRepository.connection('grupos').update({ horario_id: shift.id.value }).where({ id: group.id.value });

    const updatedGroup = await groupsRepository.connection('grupos').where({ id: group.id.value }).first();
    const agendasGroups = await AgendasGroupsMother.create(agendasGroupsRepository, {
        agenda_id: agenda.id.value,
        group_id: updatedGroup.id,
    });

    const timeSlotData = createTimeSlotData(overrides.timeSlotData || {});
    const appointmenTimeSlot = await AppointmentTimeSlotsMother.create(
        appointmentTimeSlotsRepository,
        agenda.id.value,
        timeSlotData.timeSlotStart,
        timeSlotData.timeSlotEnd
    );

    const defaultAppointmentDto = AppointmentsMother.dto({
        case_id: caso.id.value,
        agenda_id: agenda.id.value,
        start_time: timeSlotData.startTime,
        end_time: timeSlotData.endTime,
        date: timeSlotData.date,
        assigned_to: user.id.value,
        ...overrides,
    });

    return {
        user,
        caso,
        agenda,
        group: updatedGroup,
        agendasGroups,
        appointmenTimeSlot,
        appointmentDto: defaultAppointmentDto,
    };
};

const createAndRetrieveAppointment = async (overrides = {}) => {
    const { appointmentDto } = await prepareAppointmentTestData(overrides);

    await expect(TestHelper.postRequest(baseUrl, appointmentDto)).resolves.toHaveProperty('status', 201);

    const appointment = await appointmentRepository.connection('appointments').where({ id: appointmentDto.id }).first();

    return { appointment, appointmentDto };
};

const createUserWithRoleAndPolicy = async (politicRepository, roleRepository, userRepository) => {
    const politics = await PoliciesMother.createPolicy(politicRepository);
    const { id: rol_id } = await RoleMother.createRole(roleRepository, {
        policy_id: politics.id.value,
    });
    const user = await UsersMother.createUser(userRepository, {
        rol_id: rol_id.value,
    });

    return { politics, rol_id, user };
};

describe('Appointments E2E - Controller', () => {
    afterAll(async () => {
        await appointmentRepository.connection.destroy();
    });

    beforeEach(async () => {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const dynamicDate = new Date(`${date}T00:00:00.000Z`);
        jest.useFakeTimers().setSystemTime(dynamicDate);
    });

    afterEach(async () => {
        await appointmentTimeSlotsRepository.connection(appointmentTimeSlotsRepository.tableName).delete();
        jest.useRealTimers();
    });

    it('should create an appointment with related data', async () => {
        const { appointment, appointmentDto } = await createAndRetrieveAppointment();

        expect(appointment).not.toBeNull();
        expect(appointment.id).toEqual(appointmentDto.id);
        expect(appointment.case_id).toEqual(appointmentDto.case_id);
        expect(appointment.agenda_id).toEqual(appointmentDto.agenda_id);
        expect(appointment.assigned_to).toEqual(appointmentDto.assigned_to);
    });

    it('should find an appointment by ID', async () => {
        const { appointmentDto } = await createAndRetrieveAppointment();

        const foundAppointment = await appointmentRepository
            .connection('appointments')
            .where({ id: appointmentDto.id })
            .first();

        expect(foundAppointment).not.toBeNull();
        expect(foundAppointment.id).toEqual(appointmentDto.id);
        expect(foundAppointment.case_id).toEqual(appointmentDto.case_id);
        expect(foundAppointment.agenda_id).toEqual(appointmentDto.agenda_id);
    });

    it('should delete an appointment', async () => {
        const { appointmentDto } = await createAndRetrieveAppointment();

        const deletePayload = {
            deleted_at: new Date().toISOString(),
            deleted_by: appointmentDto.assigned_to,
        };

        await expect(
            TestHelper.getRequest(`${baseUrl}/${appointmentDto.id}/delete`, deletePayload)
        ).resolves.toHaveProperty('status', 200);
    });

    it('should update an appointment', async () => {
        const { appointmentDto } = await createAndRetrieveAppointment();

        const { id, created_at, created_by, ...data } = appointmentDto;

        const updatedPayload = {
            ...data,
            assigned_to: appointmentDto.assigned_to,
            is_completed: true,
        };

        await expect(TestHelper.postRequest(`${baseUrl}/${appointmentDto.id}`, updatedPayload)).resolves.toHaveProperty(
            'status',
            200
        );

        const response = await TestHelper.getRequest(`${baseUrl}/${appointmentDto.id}`);

        expect(response).toHaveProperty('status', 200);
        expect(response?.data?.data?.is_completed).toBeTruthy();
        expect(response?.data?.data?.assigned_to).toEqual(appointmentDto.assigned_to);
    });

    it('should get all appointments', async () => {
        const response = await TestHelper.getRequest(baseUrl);

        expect(response).toHaveProperty('status', 200);
    });

    it('should get an appointment by ID', async () => {
        const { appointmentDto } = await createAndRetrieveAppointment();

        const response = await TestHelper.getRequest(`${baseUrl}/${appointmentDto.id}`);

        expect(response).toHaveProperty('status', 200);
        expect(response?.data?.data?.id).toBe(appointmentDto.id);
        expect(response?.data?.data?.case_id).toBe(appointmentDto.case_id);
        expect(response?.data?.data?.agenda_id).toBe(appointmentDto.agenda_id);
    });

    it('should return 400 when getting an appointment that id invalid', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${messages.INVALID_ID}`);

        expect(response).toHaveProperty('status', 400);
    });

    it('should return 400 when deleting an appointment that does not exist', async () => {
        const deletePayload = {
            deleted_at: new Date().toISOString(),
            deleted_by: UUID_FALSE,
        };

        await expect(TestHelper.getRequest(`${baseUrl}/${UUID_FALSE}/delete`, deletePayload)).resolves.toHaveProperty(
            'status',
            400
        );
    });

    it('should search for appointments with specific criteria', async () => {
        const { caso } = await prepareAppointmentTestData();

        const searchPayload = {
            limit: 10,
            offset: 0,
            order: {
                field: 'created_at',
                direction: 'asc',
            },
            filter: [
                {
                    field: 'case_id',
                    operator: 'eq',
                    value: caso.id.value,
                    type: 'AND',
                },
            ],
        };

        const response = await TestHelper.postRequest(`${baseUrl}/search`, searchPayload);

        expect(response).toHaveProperty('status', 200);
    });

    it('should throw an error when trying to delete an appointment without required fields', async () => {
        const deletePayload = {
            deleted_at: new Date().toISOString(),
        };

        await expect(
            TestHelper.getRequest(`${baseUrl}/${messages.INVALID_ID}/delete`, deletePayload)
        ).resolves.toHaveProperty('status', 400);
    });

    it('should handle a 400 error when searching with invalid payload', async () => {
        const invalidSearchPayload = {
            limit: 'invalid-limit',
            offset: -1,
            order: {
                field: 'created_at',
                direction: 'invalid-direction',
            },
        };

        await expect(TestHelper.postRequest(`${baseUrl}/search`, invalidSearchPayload)).resolves.toHaveProperty(
            'status',
            400
        );
    });

    it('should return an error when creating an appointment with missing fields', async () => {
        const invalidPayload = {
            case_id: messages.INVALID_ID,
        };
        await expect(TestHelper.postRequest(baseUrl, invalidPayload)).resolves.toHaveProperty('status', 400);
    });

    it('should not allow updates to an appointment with invalid fields', async () => {
        const { appointmentDto } = await createAndRetrieveAppointment();

        const invalidUpdatePayload = {
            ...appointmentDto,
            start_time: 'invalid-date-format',
            end_time: 'invalid-date-format',
        };

        await expect(
            TestHelper.postRequest(`${baseUrl}/${appointmentDto.id}`, invalidUpdatePayload)
        ).resolves.toHaveProperty('status', 400);
    });

    it('should return 400 when updating a non-existent appointment', async () => {
        const updatePayload = {
            case_id: 'valid-case-id',
            agenda_id: 'valid-agenda-id',
            assigned_to: 'valid-user-id',
            start_time: '2025-01-15T14:00:00.000Z',
            end_time: '2025-01-15T15:00:00.000Z',
        };

        await expect(
            TestHelper.postRequest(`${baseUrl}/${messages.INVALID_ID}`, updatePayload)
        ).resolves.toHaveProperty('status', 400);
    });

    it('should throw an error when creating an appointment with duplicate ID', async () => {
        const { appointmentDto } = await createAndRetrieveAppointment();

        const duplicatePayload = {
            ...appointmentDto,
            id: appointmentDto.id,
        };

        await expect(TestHelper.postRequest(baseUrl, duplicatePayload)).resolves.toHaveProperty('status', 400);
    });

    it('should throw an error when creating an appointment that does not match a time slot', async () => {
        const { appointmentDto } = await createAndRetrieveAppointment();

        const now = new Date();
        now.setDate(now.getDate() + 1);
        const date = now.toISOString().split('T')[0];

        const invalidTimeSlotPayload = {
            ...appointmentDto,
            date,
            start_time: `${date}T13:45:00.000Z`,
            end_time: `${date}T14:15:00.000Z`,
            id: UUID_FALSE,
        };

        const { response } = await TestHelper.postRequest(baseUrl, invalidTimeSlotPayload);

        expect(response).toHaveProperty('status', 400);
        expect(response.data.errors[0]).toEqual({
            code: VALIDATION_ERROR,
            message: 'The request could not be processed.',
        });
    });
});
