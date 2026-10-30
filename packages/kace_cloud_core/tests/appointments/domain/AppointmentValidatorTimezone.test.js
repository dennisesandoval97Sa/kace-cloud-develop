import { jest } from '@jest/globals';
import { AppointmentValidator } from '../../../src/appointments/domain/AppointmentValidator.js';
import { TenantContext } from '../../../src/shared/infrastructure/context/TenantContext.js';

/**
 * Regression tests for the per-request timezone resolution added to
 * AppointmentValidator (helper `toTenantWallTime`, delegating to the canonical
 * `fromUTCToLocal` from `shared/calculator/functions/dateFunctions.js`).
 *
 * The agenda configuration (`appointment_time_slots`, `shift_management.work_days`)
 * is stored in the tenant's wall-clock time, while the appointment `start_time` /
 * `end_time` travel as UTC instants. The validator must reinterpret those instants
 * in the tenant timezone before comparing:
 *   - which time slot they match (`getTimeSlotByAgendaIdAndTimes` -> 'HH:mm')
 *   - which weekday / working hours apply (`work_days`)
 *
 * Resolution order (canonical, from `fromUTCToLocal`):
 *   TenantContext tenant.timezone.value -> 'America/Bogota'
 */
describe('AppointmentValidator - timezone handling', () => {
    const AGENDA_ID = '11111111-1111-1111-1111-111111111111';
    const GROUP_ID = '22222222-2222-2222-2222-222222222222';

    // 2026-09-07 is a Monday. 13:00Z -> 08:00 in Bogota (UTC-5) and 07:00 in
    // Mexico City (UTC-6, no DST). 17:00Z -> 12:00 Bogota / 11:00 Mexico City.
    const START_UTC = '2026-09-07T13:00:00.000Z';
    const END_UTC = '2026-09-07T17:00:00.000Z';

    let validationRepository;
    let validator;
    let originalTimezoneEnv;

    // The canonical resolver ignores process.env.TIMEZONE, but the runner's .env
    // sets it; clear it so these assertions exercise only TenantContext -> fallback.

    const buildDto = (overrides = {}) => ({
        agenda_id: { value: AGENDA_ID },
        date: { value: '2026-09-07' },
        start_time: { value: START_UTC },
        end_time: { value: END_UTC },
        ...overrides,
    });

    const allDayWorkDays = () =>
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].reduce((acc, day) => {
            acc[day] = { start: '00:00', end: '23:59' };
            return acc;
        }, {});

    beforeEach(() => {
        originalTimezoneEnv = process.env.TIMEZONE;
        delete process.env.TIMEZONE;

        validationRepository = {
            getDailyLimitByAgendaId: jest.fn().mockResolvedValue(100),
            countAppointmentsByAgendaAndDate: jest.fn().mockResolvedValue(0),
            getShiftByGroupId: jest.fn().mockResolvedValue({
                holidayDates: [],
                workDays: allDayWorkDays(),
            }),
            getTimeSlotByAgendaIdAndTimes: jest.fn().mockResolvedValue({ max_appointments: 10 }),
            countAppointmentsInTimeSlot: jest.fn().mockResolvedValue(0),
        };

        validator = new AppointmentValidator(validationRepository);
    });

    afterEach(() => {
        if (originalTimezoneEnv === undefined) {
            delete process.env.TIMEZONE;
        } else {
            process.env.TIMEZONE = originalTimezoneEnv;
        }
        jest.clearAllMocks();
    });

    it('matches the time slot using America/Bogota wall time when no timezone is configured', async () => {
        await validator.validateAppointmentRules(buildDto(), GROUP_ID);

        expect(validationRepository.getTimeSlotByAgendaIdAndTimes).toHaveBeenCalledWith(AGENDA_ID, '08:00', '12:00');
    });

    it('ignores process.env.TIMEZONE and uses the America/Bogota fallback when there is no tenant context', async () => {
        process.env.TIMEZONE = 'America/Mexico_City';

        await validator.validateAppointmentRules(buildDto(), GROUP_ID);

        expect(validationRepository.getTimeSlotByAgendaIdAndTimes).toHaveBeenCalledWith(AGENDA_ID, '08:00', '12:00');
    });

    it('prefers the tenant timezone from TenantContext over process.env.TIMEZONE', async () => {
        process.env.TIMEZONE = 'America/Bogota';

        const tenant = {
            id: { value: 'tenant-1' },
            timezone: { value: 'America/Mexico_City' },
        };

        await TenantContext.run(tenant, async () => {
            await validator.validateAppointmentRules(buildDto(), GROUP_ID);
        });

        expect(validationRepository.getTimeSlotByAgendaIdAndTimes).toHaveBeenCalledWith(AGENDA_ID, '07:00', '11:00');
    });

    it('resolves the timezone per request (two consecutive calls, different tenants)', async () => {
        await TenantContext.run({ id: { value: 't-bogota' }, timezone: { value: 'America/Bogota' } }, async () => {
            await validator.validateAppointmentRules(buildDto(), GROUP_ID);
        });

        await TenantContext.run({ id: { value: 't-mexico' }, timezone: { value: 'America/Mexico_City' } }, async () => {
            await validator.validateAppointmentRules(buildDto(), GROUP_ID);
        });

        expect(validationRepository.getTimeSlotByAgendaIdAndTimes).toHaveBeenNthCalledWith(
            1,
            AGENDA_ID,
            '08:00',
            '12:00'
        );
        expect(validationRepository.getTimeSlotByAgendaIdAndTimes).toHaveBeenNthCalledWith(
            2,
            AGENDA_ID,
            '07:00',
            '11:00'
        );
    });

    it('validates working hours against the tenant wall time, not the raw UTC instant', async () => {
        // 04:00Z on Monday -> in Bogota it is still Sunday 23:00.
        const startUtc = '2026-09-07T04:00:00.000Z';
        const endUtc = '2026-09-07T04:30:00.000Z';

        validationRepository.getShiftByGroupId.mockResolvedValue({
            holidayDates: [],
            workDays: {
                // No monday entry on purpose: raw UTC (Monday) would fail here.
                sunday: { start: '20:00', end: '23:59' },
            },
        });

        await expect(
            validator.validateAppointmentRules(
                buildDto({ start_time: { value: startUtc }, end_time: { value: endUtc } }),
                GROUP_ID
            )
        ).resolves.not.toThrow();

        expect(validationRepository.getTimeSlotByAgendaIdAndTimes).toHaveBeenCalledWith(AGENDA_ID, '23:00', '23:30');
    });

    it('rejects an appointment whose tenant wall time falls outside working hours', async () => {
        validationRepository.getShiftByGroupId.mockResolvedValue({
            holidayDates: [],
            workDays: {
                monday: { start: '09:00', end: '17:00' },
            },
        });

        // 13:00Z -> 08:00 Bogota, before the 09:00 opening time.
        await expect(validator.validateAppointmentRules(buildDto(), GROUP_ID)).rejects.toThrow(
            'The time is outside working hours'
        );
    });

    it('rejects an appointment on a day the tenant does not work', async () => {
        validationRepository.getShiftByGroupId.mockResolvedValue({
            holidayDates: [],
            workDays: {
                tuesday: { start: '00:00', end: '23:59' },
            },
        });

        await expect(validator.validateAppointmentRules(buildDto(), GROUP_ID)).rejects.toThrow(
            'The selected date is not a workday'
        );
    });

    it('throws when the tenant wall time does not match any available slot', async () => {
        validationRepository.getTimeSlotByAgendaIdAndTimes.mockResolvedValue(null);

        await expect(validator.validateAppointmentRules(buildDto(), GROUP_ID)).rejects.toThrow(
            'The selected date and time do not match any available time slot'
        );

        expect(validationRepository.getTimeSlotByAgendaIdAndTimes).toHaveBeenCalledWith(AGENDA_ID, '08:00', '12:00');
    });
});
