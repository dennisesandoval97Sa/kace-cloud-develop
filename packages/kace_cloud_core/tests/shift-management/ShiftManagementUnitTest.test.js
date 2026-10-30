import {
    ShiftManagement,
    ShiftManagementCollectionResponse,
    ShiftManagementResponse,
    ValueObjectHolidayDates,
    ValueObjectWorkDays,
} from '../../src/shift-management';
import { v4 as uuidv4 } from 'uuid';
import ShiftManagementMother from './domain/ShiftManagementMother';
import { DeleteFieldsDoNotExistError } from '../../src/shared/index.js';

describe('ShiftManagement Entity', () => {
    const dto = ShiftManagementMother.dto();

    it('should create a ShiftManagement with valid data', () => {
        const shiftManagement = ShiftManagement.create(dto);
        expect(shiftManagement.id.value).toBe(dto.id);
        expect(shiftManagement.holiday_dates.value).toEqual(dto.holiday_dates);
        expect(shiftManagement.work_days.value).toEqual(dto.work_days);
        expect(shiftManagement.description.value).toBe(dto.description);
        expect(shiftManagement.created_at.value).toBe(dto.created_at);
        expect(shiftManagement.created_by.value).toBe(dto.created_by);
    });

    it('should update ShiftManagement data', () => {
        const shiftManagement = ShiftManagement.create(dto);
        const newDescription = 'Updated Description';
        const newData = {
            description: newDescription,
            holiday_dates: ['2024-12-25'],
            work_days: {
                monday: { start: '08:00', end: '16:00' },
                tuesday: { start: '08:00', end: '16:00' },
                wednesday: { start: '08:00', end: '16:00' },
                thursday: { start: '08:00', end: '16:00' },
                friday: { start: '08:00', end: '16:00' },
            },
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        shiftManagement.update(newData);

        expect(shiftManagement.description.value).toBe(newDescription);
        expect(shiftManagement.holiday_dates.value).toEqual(newData.holiday_dates);
        expect(shiftManagement.work_days.value).toEqual(newData.work_days);
        expect(shiftManagement.changedAttributes).toEqual({
            description: newDescription,
            holiday_dates: JSON.stringify(newData.holiday_dates),
            work_days: newData.work_days,
            updated_at: newData.updated_at,
            updated_by: newData.updated_by,
        });
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };

        expect(() => ShiftManagement.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const shiftManagement = ShiftManagement.create(dto);
        const sameData = { ...dto };

        shiftManagement.update(sameData);

        expect(shiftManagement.changedAttributes).toEqual({});
    });

    it('marks a ShiftManagement instance as deleted', () => {
        const shiftManagement = ShiftManagement.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        shiftManagement.delete(deleteDto);

        expect(shiftManagement.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(shiftManagement.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('keeps unmarked deleted fields as null', () => {
        const shiftManagement = ShiftManagement.create(dto);
        const deleteDto = {};

        expect(() => shiftManagement.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in ShiftManagement instance', () => {
        const shiftManagement = ShiftManagement.create(dto);
        const updateDto = {
            description: 'Updated Description',
            holiday_dates: ['2024-12-25'],
            work_days: {
                monday: { start: '08:00', end: '16:00' },
                tuesday: { start: '08:00', end: '16:00' },
                wednesday: { start: '08:00', end: '16:00' },
                thursday: { start: '08:00', end: '16:00' },
                friday: { start: '08:00', end: '16:00' },
            },
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        shiftManagement.update(updateDto);
        shiftManagement.flushChanges();

        expect(shiftManagement.changedAttributes).toEqual({});
    });
});

describe('ShiftManagement Responses Tests', () => {
    it('converts ShiftManagement object to JSON representation', () => {
        const shiftManagement = ShiftManagement.create(ShiftManagementMother.dto());
        const shiftManagementResponse = new ShiftManagementResponse(shiftManagement);

        const json = shiftManagementResponse.toJson();

        expect(json).toEqual({
            data: {
                id: shiftManagement.id.value,
                holiday_dates: shiftManagement.holiday_dates.value,
                work_days: shiftManagement.work_days.value,
                description: shiftManagement.description.value,
                created_at: shiftManagement.created_at.value,
                updated_at: shiftManagement.updated_at.value,
                created_by: shiftManagement.created_by.value,
                updated_by: shiftManagement.updated_by.value,
            },
        });
    });

    it('returns an empty object if ShiftManagement is not provided', () => {
        const shiftManagementResponse = new ShiftManagementResponse(null);
        expect(shiftManagementResponse.toJson()).toEqual({});
    });

    it('converts ShiftManagementCollection to JSON representation', () => {
        const shiftManagementCollection = [
            ShiftManagement.create(ShiftManagementMother.dto()),
            ShiftManagement.create(ShiftManagementMother.dto()),
        ];
        const shiftManagementCollectionResponse = new ShiftManagementCollectionResponse(
            shiftManagementCollection,
            shiftManagementCollection.length
        );

        const json = shiftManagementCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: shiftManagementCollection.map(
                    (shiftManagement) => new ShiftManagementResponse(shiftManagement).toJson().data
                ),
            },
            metadata: {
                count: shiftManagementCollection.length,
            },
        });
    });
});
describe('ValueObjectHolidayDates Tests', () => {
    it('should create an instance with a valid value', () => {
        const validValue = ['2024-01-01', '2024-12-25'];
        const valueObject = new ValueObjectHolidayDates('holiday_dates', validValue);
        expect(valueObject).toBeInstanceOf(ValueObjectHolidayDates);
    });

    it('should throw an error if the value is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectHolidayDates('holiday_dates', value)).toThrow('The value cannot be null');
        });
    });

    it('should throw an error if any date in the array is not in the correct format', () => {
        const invalidValue = ['invalid-date'];
        expect(() => new ValueObjectHolidayDates('holiday_dates', invalidValue)).toThrow(
            'holiday_dates[0] - (invalid-date) debe ser una fecha válida en formato YYYY-MM-DD'
        );
    });

    it('should not throw an error if all dates are in the correct format', () => {
        const validValue = ['2024-01-01', '2024-03-24', '2024-12-25'];
        expect(() => new ValueObjectHolidayDates('holiday_dates', validValue)).not.toThrow();
    });
});

describe('ValueObjectWorkDays Tests', () => {
    it('should create an instance with a valid value', () => {
        const validValue = {
            monday: { start: '09:00', end: '17:00' },
            tuesday: { start: '09:00', end: '17:00' },
            wednesday: { start: '09:00', end: '17:00' },
            thursday: { start: '09:00', end: '17:00' },
            friday: { start: '09:00', end: '17:00' },
        };
        const valueObject = new ValueObjectWorkDays('work_days', validValue);
        expect(valueObject).toBeInstanceOf(ValueObjectWorkDays);
    });

    it('should throw an error if the value is null or undefined', () => {
        const invalidValues = [null, undefined];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectWorkDays('work_days', value)).toThrow('The value cannot be null');
        });
    });

    it('should throw an error if work days are incorrectly formatted', () => {
        const invalidValue = { lunes: { start: '09:00', end: '17:00' } };
        expect(() => new ValueObjectWorkDays('work_days', invalidValue)).toThrow(
            'lunes is not a valid day in work_days'
        );
    });

    it('should throw an error if work days are incorrectly formatted', () => {
        const invalidValue = { monday: { start: 'Todo el día', end: '17:00' } };
        expect(() => new ValueObjectWorkDays('work_days', invalidValue)).toThrow(
            'Invalid times for monday in work_days'
        );
    });

    it('should not throw an error if all days are correctly formatted', () => {
        const validValue = {
            monday: { start: '09:00', end: '17:00' },
            tuesday: { start: '09:00', end: '17:00' },
            wednesday: { start: '09:00', end: '17:00' },
            thursday: { start: '09:00', end: '17:00' },
            friday: { start: '09:00', end: '17:00' },
        };
        expect(() => new ValueObjectWorkDays('work_days', validValue)).not.toThrow();
    });
});
