import { KnexAgendaRepository } from '../../src/agendas/infrastructure/persistence/KnexAgendaRepository.js';
import { AppointmentTimeSlotsCollectionResponse } from '../../src/appointment-time-slots/application/AppointmentTimeSlotsCollectionResponse.js';
import { AppointmentTimeSlotsResponse } from '../../src/appointment-time-slots/application/AppointmentTimeSlotsResponse.js';
import { AppointmentTimeSlotsCreator } from '../../src/appointment-time-slots/application/create/AppointmentTimeSlotsCreator.js';
import { AppointmentTimeSlotsDeleter } from '../../src/appointment-time-slots/application/delete/AppointmentTimeSlotsDeleter.js';
import { FindAllAppointmentTimeSlots } from '../../src/appointment-time-slots/application/find-all/FindAllAppointmentTimeSlots.js';
import { AppointmentTimeSlotsFinder } from '../../src/appointment-time-slots/application/find/AppointmentTimeSlotsFinder.js';
import { AppointmentTimeSlotsSearcher } from '../../src/appointment-time-slots/application/search/AppointmentTimeSlotsSearcher.js';
import { AppointmentTimeSlotsUpdater } from '../../src/appointment-time-slots/application/update/AppointmentTimeSlotsUpdater.js';
import { KnexAppointmentTimeSlotsRepository } from '../../src/appointment-time-slots/infraestructure/persistence/KnexAppointmentTimeSlots';
import { ValidationFailError } from '../../src/shared/index.js';
import {
    APPOINTMENT_TIME_SLOT_AGENDA_NOT_FOUND,
    APPOINTMENT_TIME_SLOT_ALREADY_DELETED,
    APPOINTMENT_TIME_SLOT_ALREADY_EXISTS,
    APPOINTMENT_TIME_SLOT_EXCEEDS_AGENDA_DAILY_LIMIT,
    APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE,
    APPOINTMENT_TIME_SLOT_NOT_FOUND,
    APPOINTMENT_TIME_SLOT_OVERLAPS_EXISTING_SLOT,
} from '@kace/error-codes';
import { AgendasMother } from '../agendas/domain/AgendasMother.js';
import { knexConfig } from '../knexfile.js';
import { AppointmentTimeSlotsMother } from './domain/AppointmentTimeSlotsMother.js';
import { v4 as uuidv4 } from 'uuid';

describe('AppointmentTimeSlots Integration Tests', () => {
    const appointmentTimeSlotsRepository = new KnexAppointmentTimeSlotsRepository(knexConfig);
    const agendasRepository = new KnexAgendaRepository(appointmentTimeSlotsRepository.connection);

    const appointmentTimeSlotCreator = new AppointmentTimeSlotsCreator(appointmentTimeSlotsRepository);
    const appointmentTimeSlotFinder = new AppointmentTimeSlotsFinder(appointmentTimeSlotsRepository);
    const appointmentTimeSlotUpdater = new AppointmentTimeSlotsUpdater(appointmentTimeSlotsRepository);
    const appointmentTimeSlotDeleter = new AppointmentTimeSlotsDeleter(appointmentTimeSlotsRepository);
    const appointmentTimeSlotSearcher = new AppointmentTimeSlotsSearcher(appointmentTimeSlotsRepository);
    const findAllAppointmentTimeSlots = new FindAllAppointmentTimeSlots(appointmentTimeSlotsRepository);

    const expectValidationFailureCode = async (action, publicErrorCode) => {
        try {
            await action();
            throw new Error(`Expected ValidationFailError with public code ${publicErrorCode}`);
        } catch (error) {
            expect(error).toBeInstanceOf(ValidationFailError);
            expect(error.publicErrorCode).toBe(publicErrorCode);
        }
    };

    const setupTestData = async () => {
        const agenda = await AgendasMother.create(agendasRepository);

        return {
            agendaId: agenda.id.value,
        };
    };

    const prepareAppointmentTimeSlotDto = async (agendaId, start_time, end_time) => {
        const appointmentTimeSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);
        const appointmentTimeSlotDto = AppointmentTimeSlotsMother.dto(agendaId);

        appointmentTimeSlotDto.start_time = start_time || appointmentTimeSlot.start_time.value;
        appointmentTimeSlotDto.end_time = end_time || appointmentTimeSlot.end_time.value;

        return appointmentTimeSlotDto;
    };

    beforeEach(async () => {
        global.testData = await setupTestData();
    });

    it('should not create an appointment time slot when identical time slot exists', async () => {
        const { agendaId } = global.testData;

        const appointmentTimeSlotDto = await prepareAppointmentTimeSlotDto(agendaId);

        await expectValidationFailureCode(
            () => appointmentTimeSlotCreator.execute(appointmentTimeSlotDto),
            APPOINTMENT_TIME_SLOT_OVERLAPS_EXISTING_SLOT
        );
    });

    it('should not create an appointment time slot when overlapping at the start', async () => {
        const { agendaId } = global.testData;

        await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        const appointmentTimeSlotDto = await prepareAppointmentTimeSlotDto(agendaId, '07:30', '08:30'); // Solapa parcialmente al inicio

        await expectValidationFailureCode(
            () => appointmentTimeSlotCreator.execute(appointmentTimeSlotDto),
            APPOINTMENT_TIME_SLOT_OVERLAPS_EXISTING_SLOT
        );
    });

    it('should not create an appointment time slot when overlapping at the end', async () => {
        const { agendaId } = global.testData;

        await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        const appointmentTimeSlotDto = await prepareAppointmentTimeSlotDto(agendaId, '08:30', '09:30'); // Solapa parcialmente al final

        await expectValidationFailureCode(
            () => appointmentTimeSlotCreator.execute(appointmentTimeSlotDto),
            APPOINTMENT_TIME_SLOT_OVERLAPS_EXISTING_SLOT
        );
    });

    it('should not create an appointment time slot when overlapping entirely', async () => {
        const { agendaId } = global.testData;

        await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        const appointmentTimeSlotDto = await prepareAppointmentTimeSlotDto(agendaId, '07:00', '10:00'); // Cubre completamente el intervalo existente

        await expectValidationFailureCode(
            () => appointmentTimeSlotCreator.execute(appointmentTimeSlotDto),
            APPOINTMENT_TIME_SLOT_OVERLAPS_EXISTING_SLOT
        );
    });

    it('should not create an appointment time slot when it is entirely contained in an existing one', async () => {
        const { agendaId } = global.testData;

        await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        const appointmentTimeSlotDto = await prepareAppointmentTimeSlotDto(agendaId, '08:15', '08:45'); // Intervalo contenido completamente

        await expectValidationFailureCode(
            () => appointmentTimeSlotCreator.execute(appointmentTimeSlotDto),
            APPOINTMENT_TIME_SLOT_OVERLAPS_EXISTING_SLOT
        );
    });

    it('should create an appointment time slot when adjacent but not overlapping', async () => {
        const { agendaId } = global.testData;

        await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        const appointmentTimeSlotDto = await prepareAppointmentTimeSlotDto(agendaId, '09:00', '10:00'); // Adyacente al final de la existente

        await expect(appointmentTimeSlotCreator.execute(appointmentTimeSlotDto)).resolves.not.toThrow();
    });

    it('should not create an appointment time slot with an existing time slot', async () => {
        const { agendaId } = global.testData;

        const appointmentTimeSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        await expectValidationFailureCode(
            () => appointmentTimeSlotCreator.execute(appointmentTimeSlot.toJson()),
            APPOINTMENT_TIME_SLOT_ALREADY_EXISTS
        );
    });

    it('should not create an appointment time slot with an invalid agenda', async () => {
        const appointmentTimeSlotDto = AppointmentTimeSlotsMother.dto();

        await expectValidationFailureCode(
            () => appointmentTimeSlotCreator.execute(appointmentTimeSlotDto),
            APPOINTMENT_TIME_SLOT_AGENDA_NOT_FOUND
        );
    });

    it('should not create an appointment time slot with max_appointments greater than daily_limit in agenda', async () => {
        const { agendaId } = global.testData;

        const appointmentTimeSlotDto = AppointmentTimeSlotsMother.dto(agendaId);
        appointmentTimeSlotDto.max_appointments = 100;

        await expectValidationFailureCode(
            () => appointmentTimeSlotCreator.execute(appointmentTimeSlotDto),
            APPOINTMENT_TIME_SLOT_EXCEEDS_AGENDA_DAILY_LIMIT
        );
    });

    it('should create an appointment time slot', async () => {
        const { agendaId } = global.testData;

        const appointmentTimeSlotDto = AppointmentTimeSlotsMother.dto(agendaId);

        await appointmentTimeSlotCreator.execute(appointmentTimeSlotDto);

        const findedAppointmentTimeSlot = await appointmentTimeSlotsRepository
            .connection('appointment_time_slots')
            .where({ id: appointmentTimeSlotDto.id })
            .first();

        expect(findedAppointmentTimeSlot.id).toEqual(appointmentTimeSlotDto.id);
    });

    it('should find an appointment time slot', async () => {
        const { agendaId } = global.testData;

        const appointmentTimeSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        const foundAppointmentTimeSlot = await appointmentTimeSlotFinder.execute(appointmentTimeSlot.id.value);

        expect(foundAppointmentTimeSlot).not.toBeNull();
        expect(foundAppointmentTimeSlot).toBeInstanceOf(AppointmentTimeSlotsResponse);
        expect(foundAppointmentTimeSlot.toJson().data.id).toEqual(appointmentTimeSlot.id.value);
    });

    it('should find all appointment time slots', async () => {
        const { agendaId } = global.testData;

        await AppointmentTimeSlotsMother.createMany(appointmentTimeSlotsRepository, 3, agendaId);

        const appointmentTimeSlots = await findAllAppointmentTimeSlots.execute();

        expect(appointmentTimeSlots).not.toBeNull();
        expect(appointmentTimeSlots).toBeInstanceOf(AppointmentTimeSlotsCollectionResponse);
        expect(appointmentTimeSlots.toJson().data.items).toHaveLength(3);
    });

    it('should update an appointment time slot', async () => {
        const { agendaId } = global.testData;

        const appointmentTimeSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        await appointmentTimeSlotUpdater.execute(appointmentTimeSlot.id.value, {
            description: 'updated description',
            max_appointments: 5,
            start_time: '13:00',
            end_time: '14:00',
        });

        const updatedAppointmentTimeSlot = await appointmentTimeSlotsRepository
            .connection('appointment_time_slots')
            .where({ id: appointmentTimeSlot.id.value })
            .first();

        expect(updatedAppointmentTimeSlot).not.toBeNull();
        expect(updatedAppointmentTimeSlot.description).toEqual('updated description');
        expect(updatedAppointmentTimeSlot.max_appointments).toEqual(5);
    });

    it('should not update an appointment time slot when it overlaps with another', async () => {
        const { agendaId } = global.testData;

        const existingSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);
        await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId, '09:00', '10:00'); // Conflicto

        const dto = {
            start_time: '08:30',
            end_time: '09:30',
        };

        await expectValidationFailureCode(
            () => appointmentTimeSlotUpdater.execute(existingSlot.id.value, dto),
            APPOINTMENT_TIME_SLOT_OVERLAPS_EXISTING_SLOT
        );
    });

    it('should not update an appointment time slot if only start_time is provided', async () => {
        const { agendaId } = global.testData;

        const existingSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        const dto = {
            start_time: '08:30',
        };

        await expectValidationFailureCode(
            () => appointmentTimeSlotUpdater.execute(existingSlot.id.value, dto),
            APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE
        );
    });

    it('should not update an appointment time slot if only end_time is provided', async () => {
        const { agendaId } = global.testData;

        const existingSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        const dto = {
            end_time: '09:30',
        };

        await expectValidationFailureCode(
            () => appointmentTimeSlotUpdater.execute(existingSlot.id.value, dto),
            APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE
        );
    });

    it('should not update when exceeding daily limit', async () => {
        const { agendaId } = global.testData;

        const appointmentTimeSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        await expectValidationFailureCode(
            () =>
                appointmentTimeSlotUpdater.execute(appointmentTimeSlot.id.value, {
                    max_appointments: 100,
                }),
            APPOINTMENT_TIME_SLOT_EXCEEDS_AGENDA_DAILY_LIMIT
        );
    });

    it('should not update when appointment time slot not found', async () => {
        await expectValidationFailureCode(
            () =>
                appointmentTimeSlotUpdater.execute(uuidv4(), {
                    description: 'updated description',
                }),
            APPOINTMENT_TIME_SLOT_NOT_FOUND
        );
    });

    it('should delete an appointment time slot', async () => {
        const { agendaId } = global.testData;

        const appointmentTimeSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        await appointmentTimeSlotDeleter.execute(appointmentTimeSlot.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const deletedAppointmentTimeSlot = await appointmentTimeSlotsRepository
            .connection('appointment_time_slots')
            .where({ id: appointmentTimeSlot.id.value })
            .first();

        expect(deletedAppointmentTimeSlot.deleted_at).not.toBeNull();
    });

    it('should not delete an appointment time slot when already deleted', async () => {
        const { agendaId } = global.testData;

        const appointmentTimeSlot = await AppointmentTimeSlotsMother.create(appointmentTimeSlotsRepository, agendaId);

        await appointmentTimeSlotDeleter.execute(appointmentTimeSlot.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        await expectValidationFailureCode(
            () =>
                appointmentTimeSlotDeleter.execute(appointmentTimeSlot.id.value, {
                    deleted_at: new Date().toISOString(),
                    deleted_by: uuidv4(),
                }),
            APPOINTMENT_TIME_SLOT_ALREADY_DELETED
        );
    });

    it('should search appointment time slots', async () => {
        const { agendaId } = global.testData;
        const appointmentTimeSlots = await AppointmentTimeSlotsMother.createMany(
            appointmentTimeSlotsRepository,
            3,
            agendaId
        );

        const dtoCriteria = {
            filter: [
                {
                    field: 'agenda_id',
                    operator: 'eq',
                    value: agendaId,
                    type: 'AND',
                },
                {
                    field: 'id',
                    operator: 'eq',
                    value: appointmentTimeSlots[0].id.value,
                    type: 'AND',
                },
            ],
        };

        const appointmentTimeSlotsCollectionResponse = await appointmentTimeSlotSearcher.execute(dtoCriteria);

        expect(appointmentTimeSlotsCollectionResponse).not.toBeNull();
        expect(appointmentTimeSlotsCollectionResponse).toBeInstanceOf(AppointmentTimeSlotsCollectionResponse);
        expect(appointmentTimeSlotsCollectionResponse.toJson().data.items).toHaveLength(1);
    });
});
