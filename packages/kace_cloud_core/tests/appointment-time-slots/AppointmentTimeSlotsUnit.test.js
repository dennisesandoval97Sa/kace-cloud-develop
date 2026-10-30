import { AppointmentTimeSlots } from '../../src/appointment-time-slots/domain/AppointmentTimeSlots';
import { AppointmentTimeSlotsMother } from './domain/AppointmentTimeSlotsMother';
import {
    ValueObjectAgendaId,
    ValueObjectDescription,
    ValueObjectIsActive,
    ValueObjectMaxAppointments,
    ValueObjectStartTime,
    ValueObjectEndTime,
} from '../../src/appointment-time-slots/domain/value-objects/index.js';
import { DeleteFieldsDoNotExistError, ValueObjectTimestamp, ValueObjectUuid } from '../../src/shared/index.js';
import { v4 as uuidv4 } from 'uuid';
import { AppointmentTimeSlotsResponse } from '../../src/appointment-time-slots/application/AppointmentTimeSlotsResponse.js';
import { AppointmentTimeSlotsCollectionResponse } from '../../src/appointment-time-slots/application/AppointmentTimeSlotsCollectionResponse.js';

describe('AppointmentTimeSlots Entity', () => {
    const dto = AppointmentTimeSlotsMother.dto();

    it('should throw an error if max_appointments is not a number', () => {
        const dtoWithInvalidMaxAppointments = { ...dto, max_appointments: 'invalid' };
        expect(() => AppointmentTimeSlots.create(dtoWithInvalidMaxAppointments)).toThrow();
    });

    it('should throw an error if max_appointments is less than 0', () => {
        const dtoWithInvalidMaxAppointments = { ...dto, max_appointments: -1 };
        expect(() => AppointmentTimeSlots.create(dtoWithInvalidMaxAppointments)).toThrow();
    });

    it('should throw an error if description is not a string', () => {
        const dtoWithInvalidDescription = { ...dto, description: 1 };
        expect(() => AppointmentTimeSlots.create(dtoWithInvalidDescription)).toThrow();
    });

    it('should throw an error if end_time less than start_time', () => {
        const startTime = '09:00';
        const endTime = '08:00';
        const dtoWithInvalidEndTime = { ...dto, start_time: startTime, end_time: endTime };
        expect(() => AppointmentTimeSlots.create(dtoWithInvalidEndTime)).toThrow();
    });

    it('should throw an error if agenda_id is not a valid uuid', () => {
        const dtoWithInvalidAgendaId = { ...dto, agenda_id: 'invalid' };
        expect(() => AppointmentTimeSlots.create(dtoWithInvalidAgendaId)).toThrow();
    });

    it('should throw an error if isActive is not a boolean', () => {
        const dtoWithInvalidIsActive = { ...dto, is_active: 'invalid' };
        expect(() => AppointmentTimeSlots.create(dtoWithInvalidIsActive)).toThrow();
    });

    it('should create an entity with valid data', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);
        expect(appointmentTimeSlots).toBeInstanceOf(AppointmentTimeSlots);
        expect(appointmentTimeSlots.id.value).toBe(dto.id);
    });

    it('should validate value objects when creating an entity', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);

        expect(appointmentTimeSlots.id).toBeInstanceOf(ValueObjectUuid);
        expect(appointmentTimeSlots.id.value).toBe(dto.id);

        expect(appointmentTimeSlots.description).toBeInstanceOf(ValueObjectDescription);
        expect(appointmentTimeSlots.description.value).toBe(dto.description);

        expect(appointmentTimeSlots.start_time).toBeInstanceOf(ValueObjectStartTime);
        expect(appointmentTimeSlots.start_time.value).toBe(dto.start_time);

        expect(appointmentTimeSlots.end_time).toBeInstanceOf(ValueObjectEndTime);
        expect(appointmentTimeSlots.end_time.value).toBe(dto.end_time);

        expect(appointmentTimeSlots.agenda_id).toBeInstanceOf(ValueObjectAgendaId);
        expect(appointmentTimeSlots.agenda_id.value).toBe(dto.agenda_id);

        expect(appointmentTimeSlots.is_active).toBeInstanceOf(ValueObjectIsActive);
        expect(appointmentTimeSlots.is_active.value).toBe(dto.is_active);

        expect(appointmentTimeSlots.max_appointments).toBeInstanceOf(ValueObjectMaxAppointments);
        expect(appointmentTimeSlots.max_appointments.value).toBe(dto.max_appointments);

        expect(appointmentTimeSlots.created_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(appointmentTimeSlots.created_at.value).toBe(dto.created_at);

        expect(appointmentTimeSlots.created_by).toBeInstanceOf(ValueObjectUuid);
        expect(appointmentTimeSlots.created_by.value).toBe(dto.created_by);

        expect(appointmentTimeSlots.changedAttributes).toEqual({});
    });

    it('should update the description', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);
        const newDescription = 'new description';
        appointmentTimeSlots.description = newDescription;
        expect(appointmentTimeSlots.changedAttributes.description).toBe(newDescription);
    });

    it('should update the start_time and end_time', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);
        appointmentTimeSlots.updateTimeRange('10:00', '12:00');
        expect(appointmentTimeSlots.changedAttributes.start_time).toBe('10:00');
        expect(appointmentTimeSlots.changedAttributes.end_time).toBe('12:00');
    });

    it('should update the agenda_id', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);
        const newAgendaId = uuidv4();
        appointmentTimeSlots.agenda_id = newAgendaId;
        expect(appointmentTimeSlots.changedAttributes.agenda_id).toBe(newAgendaId);
    });

    it('should update the is_active', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);
        const newIsActive = false;
        appointmentTimeSlots.is_active = newIsActive;
        expect(appointmentTimeSlots.changedAttributes.is_active).toBe(newIsActive);
    });

    it('should update the max_appointments', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);
        const newMaxAppointments = 20;
        appointmentTimeSlots.max_appointments = newMaxAppointments;
        expect(appointmentTimeSlots.changedAttributes.max_appointments).toBe(newMaxAppointments);
    });

    it('should not update start_time and end_time if end_time is less than start_time', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);

        expect(() => appointmentTimeSlots.updateTimeRange('12:00', '10:00')).toThrow();
        expect(appointmentTimeSlots.changedAttributes.start_time).toBeUndefined();
        expect(appointmentTimeSlots.changedAttributes.end_time).toBeUndefined();
    });

    it('should not update the data if the value is the same', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);

        const newDto = {
            description: dto.description,
            start_time: dto.start_time,
            end_time: dto.end_time,
        };

        appointmentTimeSlots.update(newDto);

        expect(appointmentTimeSlots.changedAttributes).toEqual({});
    });

    it('should update the data', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);

        const newDto = {
            description: 'new description',
            max_appointments: 20,
        };

        appointmentTimeSlots.update(newDto);

        expect(appointmentTimeSlots.changedAttributes).toEqual(newDto);
    });

    it('should mark the entity as deleted', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);

        const deleteDto = {
            deleted_by: uuidv4(),
            deleted_at: new Date().toISOString(),
        };

        appointmentTimeSlots.delete(deleteDto);

        expect(appointmentTimeSlots.deleted_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(appointmentTimeSlots.deleted_by.value).toBe(deleteDto.deleted_by);

        expect(appointmentTimeSlots.deleted_by).toBeInstanceOf(ValueObjectUuid);
        expect(appointmentTimeSlots.deleted_at.value).toBe(deleteDto.deleted_at);
    });

    it('should throw an error if the deleteDto is not valid', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);

        const deleteDto = {};

        expect(() => appointmentTimeSlots.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('should flush the changed attributes', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);

        const updateDto = {
            description: 'new description',
            max_appointments: 20,
        };

        appointmentTimeSlots.update(updateDto);
        appointmentTimeSlots.flushChanges();

        expect(appointmentTimeSlots.changedAttributes).toEqual({});
    });
});

describe('AppointmentTimeSlots Responses Test', () => {
    const dto = AppointmentTimeSlotsMother.dto();

    it('should convert the entity to json', () => {
        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);
        const appointmentTimeSlotsResponse = new AppointmentTimeSlotsResponse(appointmentTimeSlots).toJson();

        const expectedResponse = {
            data: {
                ...dto,
                updated_at: appointmentTimeSlots.updated_at.value,
                deleted_at: appointmentTimeSlots.deleted_at.value,
                updated_by: appointmentTimeSlots.updated_by.value,
                deleted_by: appointmentTimeSlots.deleted_by.value,
            },
        };

        expect(appointmentTimeSlotsResponse).toEqual(expectedResponse);
    });

    it('should return an empty object if the entity is null', () => {
        const appointmentTimeSlotsResponse = new AppointmentTimeSlotsResponse(null).toJson();
        expect(appointmentTimeSlotsResponse).toEqual({});
    });

    it('should convert appointment time slots collection to json', () => {
        const appointmentTimeSlotsCollection = [AppointmentTimeSlots.create(dto), AppointmentTimeSlots.create(dto)];

        const appointmentTimeSlotsCollectionResponse = new AppointmentTimeSlotsCollectionResponse(
            appointmentTimeSlotsCollection,
            appointmentTimeSlotsCollection.length
        ).toJson();

        const expectedResponse = {
            data: {
                items: appointmentTimeSlotsCollection.map(
                    (appointmentTimeSlots) => new AppointmentTimeSlotsResponse(appointmentTimeSlots).toJson().data
                ),
            },
            metadata: {
                count: appointmentTimeSlotsCollection.length,
            },
        };

        expect(appointmentTimeSlotsCollectionResponse).toEqual(expectedResponse);
    });

    it('should return an empty items array if the collection is null', () => {
        const appointmentTimeSlotsCollectionResponse = new AppointmentTimeSlotsCollectionResponse(null, 0).toJson();
        expect(appointmentTimeSlotsCollectionResponse).toEqual({ data: { items: [] }, metadata: { count: 0 } });
    });
});
