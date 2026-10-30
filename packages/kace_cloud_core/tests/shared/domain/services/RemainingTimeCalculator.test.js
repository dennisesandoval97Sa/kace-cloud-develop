import { expect } from '@jest/globals';
import dayjs from 'dayjs';
import { remainingTimeCalculator } from '../../../../src/shared/domain/services/RemainingTimeCalculator.js';
import ShiftManagementMother from '../../../shift-management/domain/ShiftManagementMother.js';
import { ShiftManagement } from '../../../../src/shift-management/index.js';

describe('RemainingTimeCalculator', () => {
    const shift816 = { start: '08:00', end: '16:00' };
    const weekdayShiftAllDays = {
        sunday: shift816,
        monday: shift816,
        tuesday: shift816,
        wednesday: shift816,
        thursday: shift816,
        friday: shift816,
        saturday: shift816,
    };
    const weekdayShiftMondayToSaturday = {
        monday: shift816,
        tuesday: shift816,
        wednesday: shift816,
        thursday: shift816,
        friday: shift816,
        saturday: shift816,
    };
    const weekdayShiftMondayToFriday = {
        monday: shift816,
        tuesday: shift816,
        wednesday: shift816,
        thursday: shift816,
        friday: shift816,
    };

    it('should calculate remaining time within same day', async () => {
        const currentDateTime = dayjs('2025-10-03 08:20');
        const dueTime = dayjs('2025-10-03 09:10');
        const shift = new ShiftManagement(
            ShiftManagementMother.dto({
                work_days: weekdayShiftAllDays,
            })
        );

        const remainingTime = remainingTimeCalculator({
            currentDateTime,
            dueDateTime: dueTime,
            shifts: shift.work_days.value,
            workDays: shift.workDaysAsNumbers(),
            holidays: shift.holiday_dates.value,
        });

        expect(remainingTime.days).toBe(0);
        expect(remainingTime.hours).toBe(0);
        expect(remainingTime.minutes).toBe(50);
        expect(remainingTime.totalMinutes).toBe(50);
        expect(remainingTime.asText).toBe('Remaining time: 0 days, 0 hours and 50 minutes');
    });

    it('should calculate remaining hours within same day', async () => {
        const currentDateTime = dayjs('2025-10-03 08:35');
        const dueTime = dayjs('2025-10-03 13:10');
        const shift = new ShiftManagement(
            ShiftManagementMother.dto({
                work_days: weekdayShiftAllDays,
            })
        );

        const remainingTime = remainingTimeCalculator({
            currentDateTime,
            dueDateTime: dueTime,
            shifts: shift.work_days.value,
            workDays: shift.workDaysAsNumbers(),
            holidays: shift.holiday_dates.value,
        });

        expect(remainingTime.days).toBe(0);
        expect(remainingTime.hours).toBe(4);
        expect(remainingTime.minutes).toBe(35);
        expect(remainingTime.totalMinutes).toBe(275);
        expect(remainingTime.asText).toBe('Remaining time: 0 days, 4 hours and 35 minutes');
    });

    it('should calculate remaining days when working all days', async () => {
        const currentDateTime = dayjs('2025-10-03 09:00');
        const dueTime = dayjs('2025-10-06 09:10');
        const shift = new ShiftManagement(
            ShiftManagementMother.dto({
                work_days: weekdayShiftAllDays,
            })
        );

        const remainingTime = remainingTimeCalculator({
            currentDateTime,
            dueDateTime: dueTime,
            shifts: shift.work_days.value,
            workDays: shift.workDaysAsNumbers(),
            holidays: shift.holiday_dates.value,
        });

        expect(remainingTime.days).toBe(3);
        expect(remainingTime.hours).toBe(0);
        expect(remainingTime.minutes).toBe(10);
        expect(remainingTime.totalMinutes).toBe(1450);
        expect(remainingTime.asText).toBe('Remaining time: 3 days, 0 hours and 10 minutes');
    });

    it('should calculate remaining days excluding weekends with Monday to Friday schedule', async () => {
        const currentDateTime = dayjs('2025-10-03 09:00');
        const dueTime = dayjs('2025-10-07 09:10');
        const shift = new ShiftManagement(
            ShiftManagementMother.dto({
                work_days: weekdayShiftMondayToFriday,
            })
        );

        const remainingTime = remainingTimeCalculator({
            currentDateTime,
            dueDateTime: dueTime,
            shifts: shift.work_days.value,
            workDays: shift.workDaysAsNumbers(),
            holidays: shift.holiday_dates.value,
        });

        expect(remainingTime.days).toBe(2);
        expect(remainingTime.hours).toBe(0);
        expect(remainingTime.minutes).toBe(10);
        expect(remainingTime.totalMinutes).toBe(970);
        expect(remainingTime.asText).toBe('Remaining time: 2 days, 0 hours and 10 minutes');
    });

    it('should calculate remaining time excluding holidays with Monday to Saturday schedule', async () => {
        const currentDateTime = dayjs('2025-11-19 09:00');
        const dueTime = dayjs('2025-11-24 12:30');
        const shift = new ShiftManagement(
            ShiftManagementMother.dto({
                work_days: weekdayShiftMondayToSaturday,
                holiday_dates: ['2025-11-20'],
            })
        );

        const remainingTime = remainingTimeCalculator({
            currentDateTime,
            dueDateTime: dueTime,
            shifts: shift.work_days.value,
            workDays: shift.workDaysAsNumbers(),
            holidays: shift.holiday_dates.value,
        });

        expect(remainingTime.days).toBe(3);
        expect(remainingTime.hours).toBe(3);
        expect(remainingTime.minutes).toBe(30);
        expect(remainingTime.totalMinutes).toBe(1650);
        expect(remainingTime.asText).toBe('Remaining time: 3 days, 3 hours and 30 minutes');
    });
});
