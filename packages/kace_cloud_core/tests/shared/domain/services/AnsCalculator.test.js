import { AnsCalculator } from '../../../../src/shared/domain/services/AnsCalculator.js';
import { CaseAns } from '../../../../src/cases/index.js';
import { KnexAnsRepository } from '../../../../src/ans/index.js';
import { knexConfig } from '../../../knexfile.js';
import AnsMother from '../../../ans/domain/AnsMother.js';
import ShiftManagementMother from '../../../shift-management/domain/ShiftManagementMother.js';
import createDayjsInstance from '../../../../src/shared/factories/DayjsFactory.js';
import duration from 'dayjs/plugin/duration.js';
import { v4 as uuidv4 } from 'uuid';

const dayjs = createDayjsInstance({
    plugins: [duration],
});

/**
 * `AnsCalculator` razona en la zona que `DayjsFactory` fija a
 * `process.env.TIMEZONE` (America/Bogota por defecto): los limites de jornada
 * ('09:00', '17:00') son hora de pared alli.
 *
 * `ansDate('2024-01-02T07:40:00')` -- una marca sin desfase -- la lee en la zona
 * del proceso y el `.tz()` que anade la factoria la reetiqueta a Bogota, asi
 * que la hora de pared se desplaza tantas horas como haya de diferencia. Con
 * TZ=America/Bogota los dos pasos coincidian; con TZ=America/Mexico_City cuatro
 * casos cruzaban un limite de jornada y se volvian rojos.
 *
 * `ansDate` fija la hora de pared en la zona del ANS antes de nada. Las marcas
 * que ya traen desfase explicito ('-0500') no pasan por aqui: designan un
 * instante y no dependen de la zona del proceso.
 */
const ANS_TIMEZONE = process.env.TIMEZONE ?? 'America/Bogota';

const ansDate = (wallClock) => dayjs.tz(wallClock, ANS_TIMEZONE);

describe('AnsCalculator', () => {
    const ansRepository = new KnexAnsRepository(knexConfig);

    /**
     *
     * @param created_at
     * @param work_days
     * @returns {CaseAns}
     * @description Creates a CaseAns instance with the given created_at date and work_days.
     * By default holydays are 2024-01-01 2024-12-25
     * By default work_days are Monday to Friday from 09:00 to 17:00
     * By deafult intermedio is 5 and vencido is 10 and medicion_ans_id is Days
     */

    const ansTransition = {
        transitions_ans_medicion: 'Hours',
        transitions_ans_intermedio: 2,
        transitions_ans_vencido: 5,
    };

    /**
     * `ShiftManagementMother.dto` aplica el override con un spread, asi que
     * llamarlo sin `work_days` no deja el valor por defecto: lo pisa con
     * `undefined` y `CaseAns.create` revienta con "work_days: The value cannot
     * be null". Por eso el override solo se pasa cuando hay algo que pasar.
     */
    const ansCase = (created_at, work_days) => {
        return CaseAns.create({
            ...AnsMother.dto(),
            ...ShiftManagementMother.dto(work_days ? { work_days } : {}),
            ...ansTransition,
            created_at,
        });
    };

    it('should throw an error if a non-CaseAns instance is provided', async () => {
        const invalidCaseAns = 'invalid-case-ans';

        await expect(async () => {
            new AnsCalculator(invalidCaseAns, dayjs());
        }).rejects.toThrow('AnsCalculator: ans and shift values must be defined');
    });

    it('should create an instance with valid CaseAns', () => {
        const created_at = dayjs();
        const validCaseAns = ansCase(created_at);

        expect(() => new AnsCalculator(validCaseAns, dayjs())).not.toThrow();
    });

    it('Should correctly calculate the position as "VIGENTE"', () => {
        // Lunes 26 de Mayo de 2025 a las 11:00:00
        const createdAt = ansDate('2025-05-26T11:00:00').toISOString();
        // Martes 27 de Mayo de 2025 a las 11:00:00
        const currentDate = ansDate('2025-05-27T11:00:00').toISOString();
        const kase = CaseAns.create({
            ...AnsMother.diasIntermedio5Vencido10(),
            ...ShiftManagementMother.diasLaborablesLunesViernes(),
            ...ansTransition,
            createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.position).toBe(1);
    });

    it('Should correctly calculate the position as "INTERMEDIO"', () => {
        // Lunes 26 de Mayo de 2025 a las 11:00:00
        const createdAt = ansDate('2025-05-26T11:00:00').toISOString();
        // Miercoles 4 de Junio de 2025 a las 11:00:00
        const currentDate = ansDate('2025-06-04T11:00:00').toISOString();
        const kase = CaseAns.create({
            ...AnsMother.diasIntermedio5Vencido10(),
            ...ShiftManagementMother.diasLaborablesLunesViernes(),
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.position).toBe(2);
    });

    it('Should correctly calculate the position as "VENCIDO"', () => {
        // Lunes 26 de Mayo de 2025 a las 11:00:00
        const createdAt = ansDate('2025-05-26T11:00:00').toISOString();
        // Lunes 16 de Junio de 2025 a las 11:00:00
        const currentDate = ansDate('2025-06-16T11:00:00').toISOString();
        const kase = CaseAns.create({
            ...AnsMother.diasIntermedio5Vencido10(),
            ...ShiftManagementMother.diasLaborablesLunesViernes(),
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.position).toBe(3);
    });

    it('Should correctly calculate elapsed time including non-working days', () => {
        // Viernes 30 de Mayo de 2025 a las 11:00:00
        const createdAt = ansDate('2025-05-30T11:00:00').toISOString();
        // Lunes 2 de Junio de 2025 a las 11:00:00
        const currentDate = ansDate('2025-06-02T11:00:00').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesViernes();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 1 días -> 0 horas -> 0 minutos');
    });

    it('Should correctly calculate when the start date falls on a non-working day', () => {
        const createdAt = ansDate('2024-12-25T11:00:00').toISOString();
        const currentDate = ansDate('2024-12-26T10:00:00').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesConFestivos();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 0 días -> 1 horas -> 0 minutos');
    });

    /**
     * await TenantContext.run(tenant,async() => {
     */

    it('Should correctly calculate elapsed time when only a partial working day is involved', () => {
        //Martes 2 de enero de 2024 a las 10 AM
        const createdAt = ansDate('2024-01-02T10:00:00').toISOString();
        //Martes 2 de enero de 2024 a las 15:30 PM
        const currentDate = ansDate('2024-01-02T10:00:00').add(5, 'hour').add(30, 'minute').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesViernes();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 0 días -> 5 horas -> 30 minutos');
    });

    it('should correctly calculate the elapsed time for created within working hours', () => {
        //Martes 2 de enero de 2024 a las 10 AM
        const createdAt = ansDate('2024-01-02T10:00:00').toISOString();
        //Martes 2 de enero de 2024 a las 10:10 AM
        const currentDate = ansDate('2024-01-02T10:00:00').add(10, 'minute').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesViernes();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(0);
        expect(ansCalculator.hours).toBe(0);
        expect(ansCalculator.minutes).toBe(10);
    });

    it('should calculate the correct elapsed time when created before working hours but already started working', () => {
        //Martes 2 de enero de 2024 a las 7:40 AM
        const createdAt = ansDate('2024-01-02T07:40:00');
        //Martes 2 de enero de 2024 a las 9:10 AM
        const currentDate = ansDate('2024-01-02T09:10:00');

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesViernes();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(0);
        expect(ansCalculator.hours).toBe(0);
        expect(ansCalculator.minutes).toBe(10);
    });

    it("should calculate the correct elapsed time when created before working hours and work hasn't started yet", () => {
        //Martes 2 de enero de 2024 a las 7:40 AM
        const createdAt = ansDate('2024-01-02T07:40:00');
        //Martes 2 de enero de 2024 a las 7:50 AM
        const currentDate = ansDate('2024-01-02T07:50:00');

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesViernes();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(0);
        expect(ansCalculator.hours).toBe(0);
        expect(ansCalculator.minutes).toBe(0);
    });

    it('should calculate the correct elapsed time when created after working hours', () => {
        //Martes 2 de enero de 2024 a las 17:00 AM
        const createdAt = ansDate('2024-01-02T17:00:00');
        //Martes 2 de enero de 2024 a las 17:10 AM
        const currentDate = ansDate('2024-01-02T17:10:00');

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesViernes();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(0);
        expect(ansCalculator.hours).toBe(0);
        expect(ansCalculator.minutes).toBe(0);
    });

    // TODO: VALIDAR POR QUE ES TIMEPO LABORALLLL
    it('should calculate the correct elapsed time when created one day before within working hours and current time is greater than creation time', () => {
        //Martes 2 de enero de 2024 a las 17:00 AM
        const createdAt = ansDate('2024-01-02T09:00:00');
        //Martes 2 de enero de 2024 a las 17:10 AM
        const currentDate = ansDate('2024-01-03T12:00:00');

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesViernes();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(1);
        expect(ansCalculator.hours).toBe(3);
        expect(ansCalculator.minutes).toBe(0);
    });

    it('should calculate the correct elapsed time when created two days before within working hours', () => {
        //Martes 2 de enero de 2024 a las 09:20 AM
        const createdAt = ansDate('2024-01-02T09:20:00');
        //Jueves 4 de enero de 2024 a las 10:30 AM
        const currentDate = ansDate('2024-01-04T10:30:00');

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesViernes();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(2);
        expect(ansCalculator.hours).toBe(1);
        expect(ansCalculator.minutes).toBe(10);
    });

    it('should calculate the correct elapsed time when created two days before within working hours and current time is after working hours', () => {
        //Martes 2 de enero de 2024 a las 10:00 AM
        const createdAt = ansDate('2024-01-02T10:00:00');
        //Jueves 4 de enero de 2024 a las 20:00 PM
        const currentDate = ansDate('2024-01-04T20:00:00');

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesViernes();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(2);
        expect(ansCalculator.hours).toBe(7);
        expect(ansCalculator.minutes).toBe(0);
    });

    it('should return 1 day, 2 hours, and 0 minutes when created two days before outside working hours', () => {
        //Martes 2 de enero de 2024 a las 20:00 PM
        const createdAt = ansDate('2024-01-02T20:00:00');
        //Jueves 4 de enero de 2024 a las 11:00 AM
        const currentDate = ansDate('2024-01-04T11:00:00');

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesViernes();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(1);
        expect(ansCalculator.hours).toBe(2);
        expect(ansCalculator.minutes).toBe(0);
    });

    it('should return 2 days, 0 hours, and 0 minutes when created two days before outside working hours and current time is after working hours', () => {
        //Martes 2 de enero de 2024 a las 20:00 PM
        const createdAt = ansDate('2024-01-02T20:00:00');
        //Jueves 4 de enero de 2024 a las 20:00 PM
        const currentDate = ansDate('2024-01-04T20:00:00');

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesViernes();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(2);
        expect(ansCalculator.hours).toBe(0);
        expect(ansCalculator.minutes).toBe(0);
    });

    it('should return 0 days, 4 hours, and 20 minutes when created within working hours with a 24-hour workday', () => {
        //Martes 2 de enero de 2024 a las 09:30 AM
        const createdAt = ansDate('2024-01-02T09:30:00');
        //Martes 2 de enero de 2024 a las 13:50 PM
        const currentDate = ansDate('2024-01-02T13:50:00');

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesViernes();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(0);
        expect(ansCalculator.hours).toBe(4);
        expect(ansCalculator.minutes).toBe(20);
    });

    it('should return 1 day, 14 hours, and 0 minutes when created two days before with a 24-hour workday', () => {
        //Martes 2 de enero de 2024 a las 22:00 PM
        const createdAt = ansDate('2024-01-02T22:00:00');
        //Jueves 4 de enero de 2024 a las 12:00 M
        const currentDate = ansDate('2024-01-04T12:00:00');

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesDomingo24Horas();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(1);
        expect(ansCalculator.hours).toBe(14);
        expect(ansCalculator.minutes).toBe(0);
    });

    it('should return 0 days, 14 hours, and 0 minutes when created one day before with a 24-hour workday', () => {
        //Martes 2 de enero de 2024 a las 22:00 PM
        const createdAt = ansDate('2024-01-02T22:00:00');
        //Miercoles 3 de enero de 2024 a las 12:00 M
        const currentDate = ansDate('2024-01-03T12:00:00');

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesDomingo24Horas();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(0);
        expect(ansCalculator.hours).toBe(14);
        expect(ansCalculator.minutes).toBe(0);
    });

    it('should return 4 days, 1 hour, and 0 minutes when created five days before within working hours with one holiday', () => {
        //Viernes 29 de diciembre 10 AM
        const createdAt = ansDate('2023-12-29T10:00:00').toISOString();
        //Viernes 5 de enero 11 AM
        const currentDate = ansDate('2024-01-05T11:00:00').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesConFestivos();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(4);
        expect(ansCalculator.hours).toBe(1);
        expect(ansCalculator.minutes).toBe(0);
    });

    it('should return 4 days, 7 hours, and 0 minutes when created within working hours from Monday to Friday', () => {
        //Jueves 29 de agosto 10 AM
        const createdAt = ansDate('2024-08-29T10:00:00').toISOString();
        //Jueves 5 de septiembre 9 AM
        const currentDate = ansDate('2024-09-05T09:00:00').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesViernes();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.days).toBe(4);
        expect(ansCalculator.hours).toBe(7);
        expect(ansCalculator.minutes).toBe(0);
    });

    it('should calculate elapsed time with 6 days, 5 hours, and 30 minutes with personalized saturday shift', () => {
        //Sabado 18 de enero 5:41 PM
        const createdAt = dayjs('2025-01-18 17:41:26.608 -0500').toISOString();
        //Viernes 24 de enero 11:26 PM
        const currentDate = dayjs('2025-01-24 23:11:26.608 -0500').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesSabado();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 5 días -> 0 horas -> 0 minutos');
    });

    it('should calculate elapsed time with 7 days, 7 hours, and 15 minutes with personalized saturday shift', () => {
        //Sabado 18 de enero 5:41 PM
        const createdAt = dayjs('2025-01-18 17:41:26.608 -0500').toISOString();
        //Domingo 26 de enero 00:51 AM
        const currentDate = dayjs('2025-01-26 00:51:26.608 -0500').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesSabado();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 6 días -> 0 horas -> 0 minutos');
    });

    it('should calculate elapsed time with 8 days, 8 hours, and 0 minutes with personalized saturday shift', () => {
        //Sabado 18 de enero 5:41 PM
        const createdAt = dayjs('2025-01-18 17:41:26.608 -0500').toISOString();
        //Lunes 27 de enero 1:41 AM
        const currentDate = dayjs('2025-01-27 01:41:26.608 -0500').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesSabado();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 6 días -> 0 horas -> 0 minutos');
    });

    it('should calculate elapsed time with 5 days, 6 hours, and 30 minutes with personalized saturday shift', () => {
        //Sabado 18 de enero 5:41 PM
        const createdAt = dayjs('2025-01-18 17:41:26.608 -0500').toISOString();
        //Viernes 24 de enero 00:11 PM
        const currentDate = dayjs('2025-01-24 00:11:26.608 -0500').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesSabado();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 4 días -> 0 horas -> 0 minutos');
    });

    it('should calculate elapsed time with 5 days, 7 hours, and 45 minutes with personalized saturday shift', () => {
        //Sabado 18 de enero 5:41 PM
        const createdAt = dayjs('2025-01-18 17:41:26.608 -0500').toISOString();
        //Viernes 24 de enero 1:26 AM
        const currentDate = dayjs('2025-01-24 01:26:26.608 -0500').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesSabado();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 4 días -> 0 horas -> 0 minutos');
    });

    it('should calculate elapsed time with 6 days, 8 hours, and 30 minutes with personalized saturday shift', () => {
        //Sabado 18 de enero 5:41 PM
        const createdAt = dayjs('2025-01-18 17:41:26.608 -0500').toISOString();
        //Sabado 25 de enero 1:11 AM
        const currentDate = dayjs('2025-01-25 01:11:26.608 -0500').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesSabado();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 5 días -> 0 horas -> 0 minutos');
    });

    it('should calculate elapsed time with 7 days, 10 hours, and 0 minutes with personalized saturday shift', () => {
        //Sabado 18 de enero 5:41 PM
        const createdAt = dayjs('2025-01-18 17:41:26.608 -0500').toISOString();
        //Domingo 26 de enero 3:41 AM
        const currentDate = dayjs('2025-01-26 03:41:26.608 -0500').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesSabado();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 6 días -> 0 horas -> 0 minutos');
    });

    it('should calculate elapsed time with 8 days, 4 hours, and 15 minutes with personalized saturday shift', () => {
        //Sabado 18 de enero 5:41 PM
        const createdAt = dayjs('2025-01-18 17:41:26.608 -0500').toISOString();
        //Domingo 26 de enero 9:56 PM
        const currentDate = dayjs('2025-01-26 21:56:26.608 -0500').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesSabado();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 6 días -> 0 horas -> 0 minutos');
    });

    it('should calculate elapsed time with 6 days, 12 hours, and 30 minutes with personalized saturday shift', () => {
        //Sabado 18 de enero 5:41 PM
        const createdAt = dayjs('2025-01-18 17:41:26.608 -0500').toISOString();
        //Sabado 25 de enero 6:11 AM
        const currentDate = dayjs('2025-01-25 06:11:26.608 -0500').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesSabado();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 5 días -> 0 horas -> 0 minutos');
    });

    it('should calculate elapsed time with 7 days, 15 hours, and 0 minutes with personalized saturday shift', () => {
        //Sabado 18 de enero 5:41 PM
        const createdAt = dayjs('2025-01-18 17:41:26.608 -0500').toISOString();
        //Domingo 26 de enero 9:41 AM
        const currentDate = dayjs('2025-01-26 09:41:26.608 -0500').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesSabado();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 6 días -> 0 horas -> 0 minutos');
    });

    it('should calculate elapsed time with 7 days, 5 hours, and 45 minutes with personalized saturday shift', () => {
        //Sabado 18 de enero 5:41 PM
        const createdAt = dayjs('2025-01-18 17:41:26.608 -0500').toISOString();
        //Sabado 25 de enero 10:26 PM
        const currentDate = dayjs('2025-01-25 22:26:26.608 -0500').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesSabado();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 6 días -> 0 horas -> 0 minutos');
    });

    it('should calculate elapsed time with 6 days, 7 hours, and 0 minutes with personalized saturday shift', () => {
        //Sabado 18 de enero 5:41 PM
        const createdAt = dayjs('2025-01-18 17:41:26.608 -0500').toISOString();
        //Sabado 25 de enero 00:41 AM
        const currentDate = dayjs('2025-01-25 00:41:26.608 -0500').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesSabado();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 5 días -> 0 horas -> 0 minutos');
    });

    it('should calculate elapsed time with 8 days, 8 hours, and 45 minutes with personalized saturday shift', () => {
        //Sabado 18 de enero 5:41 PM
        const createdAt = dayjs('2025-01-18 17:41:26.608 -0500').toISOString();
        //Lunes 27 de enero 2:26 AM
        const currentDate = dayjs('2025-01-27 02:26:26.608 -0500').toISOString();

        let ans = AnsMother.diasIntermedio5Vencido10();
        let shift = ShiftManagementMother.diasLaborablesLunesSabado();
        const kase = CaseAns.create({
            id: uuidv4(),
            medicion_ans_id: ans.medicion_ans_id,
            intermedio: ans.intermedio,
            vencido: ans.vencido,
            work_days: shift.work_days,
            holiday_dates: shift.holiday_dates,
            ...ansTransition,
            created_at: createdAt,
        });

        const ansCalculator = new AnsCalculator(kase, currentDate, kase.created_at.value);

        expect(ansCalculator.description).toBe('Tiempo laboral transcurrido: 6 días -> 0 horas -> 0 minutos');
    });
});
