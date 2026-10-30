import { Appointment } from '../../src/appointments/domain/Appointment.js';
import {
    ValueObjectAgendaId,
    ValueObjectAssignedTo,
    ValueObjectCaseId,
    ValueObjectCustomFields,
    ValueObjectDate,
    ValueObjectEndTime,
    ValueObjectIsCanceled,
    ValueObjectIsCompleted,
    ValueObjectLastAppointmentId,
    ValueObjectStartTime,
} from '../../src/appointments/domain/value-objects/index.js';
import { AppointmentsMother } from './domain/AppointmentsMother.js';
import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';

describe('Appointment Entity', () => {
    const messages = {
        FIELDS_DELETED_NO_EXIST: 'The fields deleted_at and deleted_by do not exist in the entity: Appointment',
        VALUE_MUST_BE_OBJECT: 'custom_fields: The value must be an object',
        AGENDA_CANNOT_BE_NULL: 'agenda_id: The value cannot be null',
        CASE_CANNOT_BE_NULL: 'case_id: The value cannot be null',
        DATE_CANNOT_BE_NULL: 'date: The value cannot be null',
        START_TIME_CANNOT_BE_NULL: 'start_time: The value cannot be null',
        END_TIME_CANNOT_BE_NULL: 'end_time: The value cannot be null',
        START_TIME_INVALID: 'start_time: Invalid value Invalid Date for object timestamp',
        END_TIME_INVALID: 'end_time: Invalid value Invalid Date for object timestamp',
    };

    const dto = AppointmentsMother.dto();

    const getTomorrowTimeRange = () => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);

        const date = tomorrow.toISOString().split('T')[0];
        const startTime = `${date}T10:00:00.000Z`;
        const endTime = `${date}T11:00:00.000Z`;

        return { date, startTime, endTime };
    };

    beforeEach(async () => {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const dynamicDate = new Date(`${date}T00:00:00.000Z`);

        jest.useFakeTimers().setSystemTime(dynamicDate);
    });

    afterEach(async () => {
        jest.useRealTimers();
    });

    it('should create an Appointment entity', () => {
        const appointment = Appointment.create(dto);

        expect(appointment).toBeInstanceOf(Appointment);
        expect(appointment.case_id).toBeInstanceOf(ValueObjectCaseId);
        expect(appointment.case_id.value).toBe(dto.case_id);

        expect(appointment.agenda_id).toBeInstanceOf(ValueObjectAgendaId);
        expect(appointment.agenda_id.value).toBe(dto.agenda_id);

        expect(appointment.date).toBeInstanceOf(ValueObjectDate);
        expect(appointment.date.value).toBe(dto.date);

        expect(appointment.start_time).toBeInstanceOf(ValueObjectStartTime);
        expect(appointment.start_time.value).toBe(dto.start_time);

        expect(appointment.end_time).toBeInstanceOf(ValueObjectEndTime);
        expect(appointment.end_time.value).toBe(dto.end_time);

        expect(appointment.is_completed).toBeInstanceOf(ValueObjectIsCompleted);
        expect(appointment.is_completed.value).toBe(dto.is_completed);

        expect(appointment.is_canceled).toBeInstanceOf(ValueObjectIsCanceled);
        expect(appointment.is_canceled.value).toBe(dto.is_canceled);

        expect(appointment.custom_fields).toBeInstanceOf(ValueObjectCustomFields);
        expect(appointment.custom_fields.value).toEqual(dto.custom_fields);

        expect(appointment.last_appointment_id).toBeInstanceOf(ValueObjectLastAppointmentId);
        expect(appointment.last_appointment_id.value).toBe(dto.last_appointment_id);

        expect(appointment.assigned_to).toBeInstanceOf(ValueObjectAssignedTo);
        expect(appointment.assigned_to.value).toBe(dto.assigned_to);
    });

    it('should throw an error if agenda_id is missing', () => {
        const dtoWithoutAgendaId = { ...dto, agenda_id: null };

        expect(() => Appointment.create(dtoWithoutAgendaId)).toThrow(messages.AGENDA_CANNOT_BE_NULL);
    });

    it('should throw an error if "case_id" is missing', () => {
        const dtoWithoutCaseId = { ...dto, case_id: null };

        expect(() => Appointment.create(dtoWithoutCaseId)).toThrow(messages.CASE_CANNOT_BE_NULL);
    });

    it('should assign today as default if "date" is missing', () => {
        const dtoWithoutDate = { ...dto, date: null };

        const appointment = Appointment.create(dtoWithoutDate);

        expect(appointment.date).toBeInstanceOf(ValueObjectDate);
    });

    it('should assign current time as default if "start_time" is missing', () => {
        const dtoWithoutStartTime = { ...dto, start_time: null };

        const appointment = Appointment.create(dtoWithoutStartTime);

        expect(appointment.start_time).toBeInstanceOf(ValueObjectStartTime);
    });

    it('should assign tomorrow as default if "end_time" is missing', () => {
        const dtoWithoutEndTime = { ...dto, end_time: null };

        const appointment = Appointment.create(dtoWithoutEndTime);

        expect(appointment.end_time).toBeInstanceOf(ValueObjectEndTime);
    });

    it('should update appointments using setters', () => {
        const appointment = Appointment.create(dto);

        const { date, startTime, endTime } = getTomorrowTimeRange();

        appointment.date = date;
        appointment.start_time = startTime;
        appointment.end_time = endTime;

        const { updated_at, ...changedAttributes } = appointment.changedAttributes;

        expect(changedAttributes).toEqual({
            date,
            start_time: startTime,
            end_time: endTime,
        });
    });

    it('should update attributes using update method', () => {
        const appointment = Appointment.create(dto);

        const { date, startTime, endTime } = getTomorrowTimeRange();

        const updatedData = {
            date,
            start_time: startTime,
            end_time: endTime,
            custom_fields: { newKey: 'newValue' },
        };

        appointment.update(updatedData);

        expect(appointment.date.value).toBe(date);
        expect(appointment.start_time.value).toBe(startTime);
        expect(appointment.end_time.value).toBe(endTime);
        expect(appointment.custom_fields.value).toEqual({ newKey: 'newValue' });

        const { updated_at, ...changedAttributes } = appointment.changedAttributes;

        expect(changedAttributes).toEqual({
            date,
            start_time: startTime,
            end_time: endTime,
            custom_fields: { newKey: 'newValue' },
        });
    });

    it('should set the "deleted_at" and "deleted_by" values correctly', () => {
        const appointment = Appointment.create(dto);

        const deleteData = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        appointment.delete(deleteData);

        expect(appointment.deleted_at.value).toBe(deleteData.deleted_at);
        expect(appointment.deleted_by.value).toBe(deleteData.deleted_by);
    });

    it('should throw an error if the delete data is missing required fields', () => {
        const appointment = Appointment.create(dto);

        const deleteDataWithoutDeletedAt = {
            deleted_by: uuidv4(),
        };

        expect(() => appointment.delete(deleteDataWithoutDeletedAt)).toThrow(messages.FIELDS_DELETED_NO_EXIST);

        const deleteDataWithoutDeletedBy = {
            deleted_at: new Date().toISOString(),
        };

        expect(() => appointment.delete(deleteDataWithoutDeletedBy)).toThrow(messages.FIELDS_DELETED_NO_EXIST);
    });

    it('should filter appointments by assigned_to', () => {
        const user1 = uuidv4();
        const user2 = uuidv4();

        const appointments = [
            Appointment.create({ ...dto, assigned_to: user1 }),
            Appointment.create({ ...dto, assigned_to: user2 }),
            Appointment.create({ ...dto, assigned_to: user1 }),
        ];

        const filteredAppointments = appointments.filter((appointment) => appointment.assigned_to.value === user1);

        expect(filteredAppointments).toHaveLength(2);
        filteredAppointments.forEach((appointment) => {
            expect(appointment.assigned_to.value).toBe(user1);
        });
    });

    it('should assign empty object as default if "custom_fields" is missing or invalid', () => {
        const dtoWithInvalidCustomFields = { ...dto, custom_fields: null };

        const appointment = Appointment.create(dtoWithInvalidCustomFields);

        expect(appointment.custom_fields).toBeInstanceOf(ValueObjectCustomFields);
    });

    it('should flush the tracked changes', () => {
        const appointment = Appointment.create(dto);

        const { date, startTime, endTime } = getTomorrowTimeRange();

        appointment.update({
            date,
            start_time: startTime,
            end_time: endTime,
        });

        expect(Object.keys(appointment.changedAttributes).length).toBeGreaterThan(0);

        appointment.flushChanges();

        expect(appointment.changedAttributes).toEqual({});
    });

    it('should not modify primary attributes when deleted', () => {
        const appointment = Appointment.create(dto);

        const deleteData = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        appointment.delete(deleteData);

        expect(appointment.case_id.value).toBe(dto.case_id);
        expect(appointment.date.value).toBe(dto.date);
        expect(appointment.start_time.value).toBe(dto.start_time);
        expect(appointment.end_time.value).toBe(dto.end_time);
    });

    it('should flush changes after deletion', () => {
        const appointment = Appointment.create(dto);

        const deleteData = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        appointment.delete(deleteData);

        expect(Object.keys(appointment.changedAttributes).length).toBeGreaterThan(0);

        appointment.flushChanges();

        expect(appointment.changedAttributes).toEqual({});
    });

    it('should track deleted_at and deleted_by in changedAttributes', () => {
        const appointment = Appointment.create(dto);

        const deleteData = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        appointment.delete(deleteData);

        const { updated_at, ...changedAttributes } = appointment.changedAttributes;

        expect(changedAttributes).toEqual({
            deleted_at: deleteData.deleted_at,
            deleted_by: deleteData.deleted_by,
        });
    });

    it('should throw an error if start_time formatis invalid', () => {
        const invalidDto = {
            ...dto,
            start_time: '10:00',
        };

        expect(() => Appointment.create(invalidDto)).toThrow(messages.START_TIME_INVALID);
    });

    it('should throw an error if end_time formatis invalid', () => {
        const invalidDto = {
            ...dto,
            end_time: '10:00',
        };

        expect(() => Appointment.create(invalidDto)).toThrow(messages.END_TIME_INVALID);
    });
});
