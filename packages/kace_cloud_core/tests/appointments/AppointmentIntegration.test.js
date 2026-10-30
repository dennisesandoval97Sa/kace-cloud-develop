import { AppointmentCreator } from '../../src/appointments/application/create/AppointmentCreator.js';
import { AppointmentUpdater } from '../../src/appointments/application/update/AppointmentUpdater.js';
import { AppointmentDeleter } from '../../src/appointments/application/delete/AppointmentDeleter.js';
import { AppointmentSearcher } from '../../src/appointments/application/search/AppointmentSearcher.js';
import { AppointmentReScheduler } from '../../src/appointments/application/re-scheduler/AppointmentReScheduler.js';
import { KnexAppointmentRepository } from '../../src/appointments/infrastructure/persistence/KnexAppointmentRepository.js';
import { KnexAppointmentValidationRepository } from '../../src/appointments/infrastructure/persistence/KnexAppointmentValidationRepository.js';
import { KnexUsersRepository } from '../../src/users/infrastructure/KnexUsersRepository.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { KnexAgendaRepository } from '../../src/agendas/infrastructure/persistence/KnexAgendaRepository.js';
import { KnexGroupsRepository } from '../../src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import { KnexAgendasGroupsRepository } from '../../src/agendas-groups/infrastructure/persistence/KnexAgendasGroupsRepository.js';
import { KnexAppointmentTimeSlotsRepository } from '../../src/appointment-time-slots/infraestructure/persistence/KnexAppointmentTimeSlots.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/';
import { AppointmentsMother } from './domain/AppointmentsMother.js';
import { AgendasMother } from '../agendas/domain/AgendasMother.js';
import { AgendasGroupsMother } from '../agendas-groups/domain/AgendasGroupsMother.js';
import { AppointmentTimeSlotsMother } from '../appointment-time-slots/domain/AppointmentTimeSlotsMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import UsersMother from '../users/domain/UsersMother.js';
import CasesMother from '../cases/domain/CasesMother.js';
import { AppointmentValidator } from '../../src/appointments/domain/AppointmentValidator.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';
import createDayjsInstance from '../../src/shared/factories/DayjsFactory.js';
import { ValueObjectUuid } from '../../src/shared/index.js';

const dayjs = createDayjsInstance({});

describe('Appointment Integration Tests', () => {
    const appointmentRepository = new KnexAppointmentRepository(knexConfig);
    const userRepository = new KnexUsersRepository(appointmentRepository.connection);
    const caseRepository = new KnexCaseRepository(appointmentRepository.connection);
    const agendaRepository = new KnexAgendaRepository(appointmentRepository.connection);
    const validatorRepository = new KnexAppointmentValidationRepository(appointmentRepository.connection);
    const agendasGroupsRepository = new KnexAgendasGroupsRepository(appointmentRepository.connection);
    const appointTimeSlotsRepository = new KnexAppointmentTimeSlotsRepository(appointmentRepository.connection);
    const groupsRepository = new KnexGroupsRepository(appointmentRepository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(appointmentRepository.connection);

    let appointmentCreator;

    const messages = {
        APPOINTMENT_NOT_FOUND: 'Appointment not found',
        APPOINTMENT_ALREADY_DELETED: 'Appointment already deleted',
        ID_FOR_VALUE_OBJECT_UUID: 'id: Invalid value Invalid id for object uuid',
        INVALID_ID: 'Invalid id',
        ID_ALREADY_EXISTS: 'Id already exists',
        INVALID_APPOINTMENT_DATA: 'Invalid appointment data provided',
        NOT_MATCH_TIME_SLOT: 'The selected date and time do not match any available time slot',
        REQUIRED_GROUP_ID: 'group_id: The value cannot be null',
    };

    const getTomorrowTimeRange = () => {
        const now = dayjs();
        const tomorrow = now.add(1, 'day');

        const date = tomorrow.format('YYYY-MM-DD');
        const startTime = tomorrow.set('hour', 9).set('minute', 0).toISOString();
        const endTime = tomorrow.set('hour', 10).set('minute', 0).toISOString();

        return { date, startTime, endTime };
    };

    const defaultWorkDays = () => ({
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' },
        saturday: { start: '09:00', end: '17:00' },
        sunday: { start: '09:00', end: '17:00' },
    });

    const prepareAppointmentTestData = async (overrides = {}, { slot = ['09:00', '10:00'], workDays } = {}) => {
        const user = await UsersMother.createUser(userRepository);
        const caso = await CasesMother.createCase(caseRepository);
        const agenda = await AgendasMother.create(agendaRepository);
        const group = await GroupsMother.createGroup(
            groupsRepository,
            shiftManagementRepository,
            {},
            {
                work_days: workDays || defaultWorkDays(),
            }
        );
        const agendasGroups = await AgendasGroupsMother.create(agendasGroupsRepository, {
            agenda_id: agenda.id.value,
            group_id: group.id.value,
        });

        const appointmenTimeSlot = await AppointmentTimeSlotsMother.create(
            appointTimeSlotsRepository,
            agenda.id.value,
            slot[0],
            slot[1]
        );

        const { date, startTime, endTime } = getTomorrowTimeRange();

        const defaultAppointmentDto = AppointmentsMother.dto({
            case_id: caso.id.value,
            group_id: group.id.value,
            agenda_id: agenda.id.value,
            date,
            start_time: startTime,
            end_time: endTime,
            assigned_to: user.id.value,
            ...overrides,
        });

        return {
            user,
            caso,
            agenda,
            group,
            agendasGroups,
            appointmenTimeSlot,
            appointmentDto: defaultAppointmentDto,
        };
    };

    beforeEach(async () => {
        appointmentCreator = new AppointmentCreator(appointmentRepository, validatorRepository);

        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const dynamicDate = new Date(`${date}T00:00:00.000Z`);

        jest.useFakeTimers().setSystemTime(dynamicDate);
    });

    afterEach(async () => {
        jest.useRealTimers();
    });

    const createAndRetrieveAppointment = async (overrides = {}) => {
        const { appointmentDto } = await prepareAppointmentTestData(overrides);
        await appointmentCreator.execute(appointmentDto);

        const appointment = await appointmentRepository
            .connection('appointments')
            .where({ id: appointmentDto.id })
            .first();

        return { appointment, appointmentDto };
    };

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

    it('should find all appointments using createMany', async () => {
        const { user, caso, agenda } = await prepareAppointmentTestData();

        await AppointmentsMother.createMany(appointmentRepository, 5, {
            assigned_to: user.id.value,
            case_id: caso.id.value,
            agenda_id: agenda.id.value,
        });

        const foundAppointments = await appointmentRepository.connection('appointments').select();

        expect(foundAppointments).not.toBeNull();
        expect(foundAppointments).toHaveLength(5);

        foundAppointments.forEach((appointment) => {
            expect(appointment.case_id).toEqual(caso.id.value);
            expect(appointment.agenda_id).toEqual(agenda.id.value);
            expect(appointment.assigned_to).toEqual(user.id.value);
        });
    });

    it('should update an appointment', async () => {
        const {
            appointmentDto,
            appointmentDto: { id },
        } = await prepareAppointmentTestData();

        const appointmentCreator = new AppointmentCreator(appointmentRepository, validatorRepository);

        await appointmentCreator.execute(appointmentDto);

        const newUser = await UsersMother.createUser(userRepository);

        const valuesToUpdate = {
            is_completed: true,
            assigned_to: newUser.id.value,
            group_id: appointmentDto.group_id,
        };

        const appointmentUpdater = new AppointmentUpdater(appointmentRepository, validatorRepository);

        await appointmentUpdater.execute(id, valuesToUpdate);

        const updatedAppointment = await appointmentRepository.connection('appointments').where({ id }).first();

        expect(updatedAppointment).not.toBeNull();
        expect(updatedAppointment.is_completed).toBeTruthy();
        expect(updatedAppointment.assigned_to).toEqual(newUser.id.value);
        expect(updatedAppointment.case_id).toEqual(appointmentDto.case_id);
        expect(updatedAppointment.agenda_id).toEqual(appointmentDto.agenda_id);
    });

    it('should delete an appointment', async () => {
        const {
            appointmentDto,
            appointmentDto: { id },
            user,
        } = await prepareAppointmentTestData();

        const appointmentCreator = new AppointmentCreator(appointmentRepository, validatorRepository);

        await appointmentCreator.execute(appointmentDto);

        const deleteData = {
            deleted_at: new Date().toISOString(),
            deleted_by: user.id.value,
        };

        const appointmentDeleter = new AppointmentDeleter(appointmentRepository);

        await appointmentDeleter.execute(id, deleteData);

        const deletedAppointment = await appointmentRepository.connection('appointments').where({ id }).first();

        expect(deletedAppointment).not.toBeNull();
        // `appointments.deleted_at` es un timestamp: postgres lo devuelve como `Date`.
        expect(new Date(deletedAppointment.deleted_at).toISOString()).toEqual(deleteData.deleted_at);
        expect(deletedAppointment.deleted_by).toEqual(deleteData.deleted_by);
        expect(deletedAppointment.case_id).toEqual(appointmentDto.case_id);
        expect(deletedAppointment.agenda_id).toEqual(appointmentDto.agenda_id);
        expect(deletedAppointment.assigned_to).toEqual(appointmentDto.assigned_to);
    });

    it('should search for appointments instances with given criteria', async () => {
        const { user, caso, agenda } = await prepareAppointmentTestData();

        await AppointmentsMother.createMany(appointmentRepository, 5, {
            assigned_to: user.id.value,
            case_id: caso.id.value,
            agenda_id: agenda.id.value,
        });

        const dtoCriteria = {
            filter: undefined,
            limit: 10,
            offset: 0,
            order: {
                field: 'created_at',
                direction: 'asc',
            },
            relationship: [
                {
                    table: 'cases',
                    type: 'join',
                    condition: {
                        column: 'cases.id',
                        refColumn: 'appointments.case_id',
                    },
                },
            ],
        };

        const appointmentSearcher = new AppointmentSearcher(appointmentRepository);
        const appointmentsCollectionResponse = await appointmentSearcher.execute(dtoCriteria);

        expect(appointmentsCollectionResponse).not.toBeNull();
        expect(appointmentsCollectionResponse.toJson().data.items).toHaveLength(5);
    });

    it('should not delete an appointment with an invalid ID', async () => {
        const {
            appointmentDto,
            appointmentDto: { id },
            user,
        } = await prepareAppointmentTestData();

        const appointmentCreator = new AppointmentCreator(appointmentRepository, validatorRepository);

        await appointmentCreator.execute(appointmentDto);

        const invalidId = messages.INVALID_ID;
        const deleteData = {
            deleted_at: new Date().toISOString(),
            deleted_by: user.id.value,
        };

        const appointmentDeleter = new AppointmentDeleter(appointmentRepository);

        await expect(appointmentDeleter.execute(invalidId, deleteData)).rejects.toThrow(
            messages.ID_FOR_VALUE_OBJECT_UUID
        );

        const notDeletedAppointment = await appointmentRepository.connection('appointments').where({ id }).first();

        expect(notDeletedAppointment).not.toBeNull();
        expect(notDeletedAppointment.deleted_at).toBeNull();
        expect(notDeletedAppointment.deleted_by).toBeNull();
    });

    it('should throw an error when creating an appointment with an existing id', async () => {
        const { appointmentDto } = await prepareAppointmentTestData();

        const appointmentCreator = new AppointmentCreator(appointmentRepository, validatorRepository);

        await appointmentCreator.execute(appointmentDto);

        await expect(appointmentCreator.execute(appointmentDto)).rejects.toThrow(messages.ID_ALREADY_EXISTS);
    });

    it('should throw an error when trying to delete an already deleted appointment', async () => {
        const {
            appointmentDto,
            appointmentDto: { id },
            user,
        } = await prepareAppointmentTestData();

        const appointmentCreator = new AppointmentCreator(appointmentRepository, validatorRepository);

        await appointmentCreator.execute(appointmentDto);

        const deleteData = {
            deleted_at: new Date().toISOString(),
            deleted_by: user.id.value,
        };

        const appointmentDeleter = new AppointmentDeleter(appointmentRepository);

        await appointmentDeleter.execute(id, deleteData);

        await expect(appointmentDeleter.execute(id, deleteData)).rejects.toThrow(messages.APPOINTMENT_ALREADY_DELETED);
    });

    it('should throw an error when updating a non-existent appointment', async () => {
        const { appointmentDto } = await prepareAppointmentTestData();
        const invalidId = uuidv4();
        const updateData = { is_completed: true, group_id: appointmentDto.group_id };

        const appointmentUpdater = new AppointmentUpdater(appointmentRepository, validatorRepository);

        await expect(appointmentUpdater.execute(invalidId, updateData)).rejects.toThrow(messages.APPOINTMENT_NOT_FOUND);
    });

    it('should reschedule an appointment by creating a new one and updating the previous one 2', async () => {
        const user = await UsersMother.createUser(userRepository);
        const caso = await CasesMother.createCase(caseRepository);
        const agenda = await AgendasMother.create(agendaRepository);
        const group = await GroupsMother.createGroup(
            groupsRepository,
            shiftManagementRepository,
            {},
            {
                work_days: {
                    monday: { start: '09:00', end: '17:00' },
                    tuesday: { start: '09:00', end: '17:00' },
                    wednesday: { start: '09:00', end: '17:00' },
                    thursday: { start: '09:00', end: '17:00' },
                    friday: { start: '09:00', end: '17:00' },
                    saturday: { start: '09:00', end: '17:00' },
                    sunday: { start: '09:00', end: '17:00' },
                },
            }
        );

        await AgendasGroupsMother.create(agendasGroupsRepository, {
            agenda_id: agenda.id.value,
            group_id: group.id.value,
        });

        const appointmentTimeSlot = await AppointmentTimeSlotsMother.create(
            appointTimeSlotsRepository,
            agenda.id.value,
            '09:00',
            '10:00'
        );

        const firstAppointmentDate = dayjs();
        const firstAppointmentDto = AppointmentsMother.dto({
            case_id: caso.id.value,
            group_id: group.id.value,
            agenda_id: agenda.id.value,
            date: firstAppointmentDate.toISOString().split('T')[0],
            start_time: firstAppointmentDate.set('hour', 9).set('minute', 0).toISOString(),
            end_time: firstAppointmentDate.set('hour', 10).set('minute', 0).toISOString(),
            assigned_to: user.id.value,
        });
        const appointmentCreator = new AppointmentCreator(appointmentRepository, validatorRepository);
        await appointmentCreator.execute(firstAppointmentDto);

        const secondAppointmentDate = dayjs().add(1, 'day');
        const secondAppointmentDto = AppointmentsMother.dto({
            case_id: caso.id.value,
            group_id: group.id.value,
            agenda_id: agenda.id.value,
            date: secondAppointmentDate.toISOString().split('T')[0],
            start_time: secondAppointmentDate.set('hour', 9).set('minute', 0).toISOString(),
            end_time: secondAppointmentDate.set('hour', 10).set('minute', 0).toISOString(),
            assigned_to: user.id.value,
            updated_at: new Date().toISOString(),
            updated_by: user.id.value,
        });
        const appointmentReScheduler = new AppointmentReScheduler(appointmentRepository, validatorRepository);
        await appointmentReScheduler.execute(firstAppointmentDto.id, secondAppointmentDto);

        const firstAppointment = await appointmentRepository
            .connection('appointments')
            .where({ id: firstAppointmentDto.id })
            .first();

        expect(firstAppointment).not.toBeNull();
        expect(firstAppointment.is_canceled).toBeTruthy();

        const secondAppointment = await appointmentRepository
            .connection('appointments')
            .where({ id: secondAppointmentDto.id })
            .first();

        expect(secondAppointment).not.toBeNull();
        expect(secondAppointment.is_canceled).toBeFalsy();
        expect(secondAppointment.case_id).toEqual(caso.id.value);
        expect(secondAppointment.agenda_id).toEqual(agenda.id.value);
        expect(secondAppointment.assigned_to).toEqual(user.id.value);
        expect(secondAppointment.last_appointment_id).toEqual(firstAppointment.id);
    });

    it('should throw an error when trying to reschedule a non-existent appointment', async () => {
        const { user, caso, agenda } = await prepareAppointmentTestData();

        const invalidId = uuidv4();

        const newAppointmentDto = AppointmentsMother.dto({
            case_id: caso.id.value,
            agenda_id: agenda.id.value,
            assigned_to: user.id.value,
            updated_at: new Date().toISOString(),
            updated_by: user.id.value,
        });

        const appointmentReScheduler = new AppointmentReScheduler(appointmentRepository, validatorRepository);

        await expect(appointmentReScheduler.execute(invalidId, newAppointmentDto)).rejects.toThrow(
            messages.APPOINTMENT_NOT_FOUND
        );
    });

    it('should throw an error when required fields are missing', async () => {
        const invalidDto = {};

        const appointmentValidator = new AppointmentValidator(validatorRepository);

        await expect(appointmentValidator.validateAppointmentRules(invalidDto)).rejects.toThrow(
            messages.INVALID_APPOINTMENT_DATA
        );
    });

    it('should throw a reschedule error because the selected date and time does not match any available time', async () => {
        const {
            appointmentDto,
            appointmentDto: { id },
            user,
            caso,
            agenda,
        } = await prepareAppointmentTestData();

        const appointmentCreator = new AppointmentCreator(appointmentRepository, validatorRepository);

        await appointmentCreator.execute(appointmentDto);

        const { date } = getTomorrowTimeRange();
        const startTime = `${date}T15:30:00.000Z`;
        const endTime = `${date}T16:00:00.000Z`;

        const newAppointmentDto = AppointmentsMother.dto({
            case_id: caso.id.value,
            agenda_id: agenda.id.value,
            assigned_to: user.id.value,
            updated_at: new Date().toISOString(),
            updated_by: user.id.value,
            date,
            start_time: startTime,
            end_time: endTime,
        });

        newAppointmentDto.group_id = appointmentDto.group_id;
        const appointmentReScheduler = new AppointmentReScheduler(appointmentRepository, validatorRepository);

        await expect(appointmentReScheduler.execute(id, newAppointmentDto)).rejects.toThrow(
            messages.NOT_MATCH_TIME_SLOT
        );
    });

    it('should throw an error when creating an appointment without group_id', async () => {
        const { appointmentDto } = await prepareAppointmentTestData();
        delete appointmentDto.group_id;
        const appointmentCreator = new AppointmentCreator(appointmentRepository, validatorRepository);

        await expect(appointmentCreator.execute(appointmentDto)).rejects.toThrow(messages.REQUIRED_GROUP_ID);
    });

    it('should throw an error when update an appointment without group_id', async () => {
        const { appointmentDto } = await prepareAppointmentTestData();

        const appointmentCreator = new AppointmentCreator(appointmentRepository, validatorRepository);
        await appointmentCreator.execute(appointmentDto);

        delete appointmentDto.group_id;

        const appointmentUpdater = new AppointmentUpdater(appointmentRepository, validatorRepository);
        await expect(appointmentUpdater.execute(appointmentDto.id, appointmentDto)).rejects.toThrow(
            messages.REQUIRED_GROUP_ID
        );
    });

    it('should throw an error when re schedule an appointment without group_id', async () => {
        const { appointmentDto } = await prepareAppointmentTestData();

        const appointmentCreator = new AppointmentCreator(appointmentRepository, validatorRepository);
        await appointmentCreator.execute(appointmentDto);

        delete appointmentDto.group_id;
        const appointmentReScheduler = new AppointmentReScheduler(appointmentRepository, validatorRepository);

        await expect(appointmentReScheduler.execute(appointmentDto.id, appointmentDto)).rejects.toThrow(
            messages.REQUIRED_GROUP_ID
        );
    });

    it('Method getShiftByGroupId must return data whit the valid properties "holidayDates" and "workDays"', async () => {
        const { appointmentDto } = await prepareAppointmentTestData();
        const group_id = new ValueObjectUuid('group_id', appointmentDto.group_id);
        const shiftData = await validatorRepository.getShiftByGroupId(group_id);

        await expect(shiftData).toHaveProperty('holidayDates');
        await expect(shiftData).toHaveProperty('workDays');
    });

    it('Method getShiftByGroupId should throw an error when group_id not match whit a shiftManagment in database', async () => {
        const id = uuidv4();
        const invalidGroupId = new ValueObjectUuid('group_id', id);
        await expect(validatorRepository.getShiftByGroupId(invalidGroupId)).rejects.toThrow();
    });

    describe('timezone handling (UTC instant -> tenant wall time)', () => {
        // The agenda config (time slots, work_days) is stored in the tenant wall
        // clock; the appointment start/end travel as UTC instants. With no tenant
        // context the canonical resolver (`fromUTCToLocal`) falls back to
        // America/Bogota (UTC-5) — it does NOT read process.env.TIMEZONE, so these
        // assertions are hermetic regardless of the runner's environment.
        const bogotaTomorrow = () => dayjs().add(1, 'day').format('YYYY-MM-DD');

        it('accepts an appointment whose UTC start_time maps to a valid slot once converted to America/Bogota', async () => {
            const date = bogotaTomorrow();
            // 14:00Z / 15:00Z === 09:00 / 10:00 in America/Bogota.
            const { appointmentDto } = await prepareAppointmentTestData(
                {
                    date,
                    start_time: `${date}T14:00:00.000Z`,
                    end_time: `${date}T15:00:00.000Z`,
                },
                { slot: ['09:00', '10:00'], workDays: { ...defaultWorkDays() } }
            );

            await expect(appointmentCreator.execute(appointmentDto)).resolves.not.toThrow();

            const appointment = await appointmentRepository
                .connection('appointments')
                .where({ id: appointmentDto.id })
                .first();

            expect(appointment).not.toBeNull();
            expect(appointment.id).toEqual(appointmentDto.id);
        });

        it('rejects an appointment that would only match a slot if start_time were compared as raw UTC', async () => {
            const date = bogotaTomorrow();
            // Slot is 09:00-10:00 tenant time. 09:00Z would naively match '09:00'
            // but in America/Bogota it is 04:00 -> no slot at that hour.
            // Working hours are wide open so the failure is the slot check.
            const wideOpen = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].reduce(
                (acc, day) => {
                    acc[day] = { start: '00:00', end: '23:59' };
                    return acc;
                },
                {}
            );

            const { appointmentDto } = await prepareAppointmentTestData(
                {
                    date,
                    start_time: `${date}T09:00:00.000Z`,
                    end_time: `${date}T10:00:00.000Z`,
                },
                { slot: ['09:00', '10:00'], workDays: wideOpen }
            );

            await expect(appointmentCreator.execute(appointmentDto)).rejects.toThrow(messages.NOT_MATCH_TIME_SLOT);
        });

        it('accepts an appointment when the slot itself is defined in tenant wall time (08:00-12:00)', async () => {
            const date = bogotaTomorrow();
            // 13:00Z / 17:00Z === 08:00 / 12:00 in America/Bogota.
            const workDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].reduce(
                (acc, day) => {
                    acc[day] = { start: '08:00', end: '18:00' };
                    return acc;
                },
                {}
            );

            const { appointmentDto } = await prepareAppointmentTestData(
                {
                    date,
                    start_time: `${date}T13:00:00.000Z`,
                    end_time: `${date}T17:00:00.000Z`,
                },
                { slot: ['08:00', '12:00'], workDays }
            );

            await expect(appointmentCreator.execute(appointmentDto)).resolves.not.toThrow();
        });
    });
});
