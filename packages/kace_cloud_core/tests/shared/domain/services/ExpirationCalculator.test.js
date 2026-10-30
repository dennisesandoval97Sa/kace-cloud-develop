import { CaseAns } from '../../../../src/cases/index.js';
import { ExpirationCalculator } from '../../../../src/shared/domain/services/ExpirationCalculator.js';
import AnsMother from '../../../ans/domain/AnsMother.js';
import ShiftManagementMother from '../../../shift-management/domain/ShiftManagementMother.js';
import dayjs from 'dayjs';
import dayjsUtc from 'dayjs/plugin/utc.js';
import dayjsTimezone from 'dayjs/plugin/timezone.js';
import { Ans, Types } from '../../../../src/ans/index.js';
import ClassificationsMother from '../../../classifications/domain/ClassificationsMother.js';
import { GroupsMother } from '../../../grupos/domain/GroupsMother.js';
import { TransitionsMother } from '../../../transition/domain/TransitionsMother.js';
import CasesMother from '../../../cases/domain/CasesMother.js';
import { ShiftManagement } from '../../../../src/shift-management/index.js';

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTimezone);

/**
 * `ExpirationCalculator` no razona en la zona del proceso: usa la instancia que
 * `DayjsFactory` fija a `process.env.TIMEZONE` (America/Bogota por defecto), y
 * todos los limites de jornada ('09:00', '17:00') son hora de pared en esa zona.
 *
 * Las fechas de este fichero se escribian como cadenas sueltas, que `dayjs` lee
 * en la zona local y el calculador reinterpreta en Bogota. Con TZ=America/Bogota
 * las dos coincidian y la suite pasaba; con TZ=America/Mexico_City cada entrada
 * se corria una hora y 13 de los 20 casos se volvian rojos.
 *
 * `ansDate` ancla la hora de pared a la zona del ANS antes de entrar, y
 * `formatAnsDate` la devuelve a esa misma zona al salir (`expiredAt` es un ISO
 * en UTC). Asi las esperas literales valen en cualquier TZ.
 */
const ANS_TIMEZONE = process.env.TIMEZONE ?? 'America/Bogota';

const ansDate = (wallClock) => dayjs.tz(wallClock, ANS_TIMEZONE).toISOString();

const formatAnsDate = (value) => dayjs(value).tz(ANS_TIMEZONE).format('YYYY-MM-DD HH:mm');

describe('ExpirationCalculator', () => {
    const shiftAllDaysOfWeek = {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' },
        saturday: { start: '09:00', end: '17:00' },
        sunday: { start: '09:00', end: '17:00' },
    };

    const ansTransition = {
        transitions_ans_medicion: 'Hours',
        transitions_ans_intermedio: 2,
        transitions_ans_vencido: 5,
    };

    const ansCase = (created_at, ans = {}, horario = {}) => {
        return CaseAns.create({
            ...AnsMother.dto(ans),
            ...ShiftManagementMother.dto(horario),
            ...ansTransition,
            created_at,
        });
    };

    const createCase = async ({
        medicionAnsId = Types.MINUTES.value,
        ansValues = { intermedio: 30, vencido: 60 },
        ansTransitionValues = { intermedio: 10, vencido: 20 },
        caseValues = {},
        workStart,
        includeWeekends,
        workEnd,
        holidayDates = [],
    }) => {
        const ans = await AnsMother.createAns(ansRepository, {
            ...ansValues,
            medicion_ans_id: medicionAnsId,
        });

        const classification = await ClassificationsMother.create(classificationRepository, {
            ans_id: ans.id.value,
        });

        const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository, {
            holiday_dates: holidayDates,
            work_days: getWorkDays(workStart, includeWeekends, workEnd),
        });

        const group = await GroupsMother.createWithCustomShiftManagement(groupsRepository, shiftManagement);

        const transitionAns = await AnsMother.createAns(ansRepository, {
            ...ansTransitionValues,
            medicion_ans_id: medicionAnsId,
        });

        const transitions = await TransitionsMother.createRandomTransition(transitionsRepository, {
            ans_id: transitionAns.id.value,
        });

        const kase = await CasesMother.createCase(caseRepository, {
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
            fecha_resolucion: null,
            transicion_id: transitions.id.value,
            created_at: Date.now(),
            ...caseValues,
        });

        return { kase: kase, caseAns: ans, shiftManagement: shiftManagement, stateAns: transitionAns };
    };

    it('obtener la fecha de vencimiento de ansMinutos dentro de la jornada laboral', () => {
        const createdAt = ansDate('2023-02-01 10:00');
        const expireAt = '2023-02-01 10:50';
        const currentDate = ansDate('2023-02-01 10:30');
        const ans = new Ans(AnsMother.dto({ intermedio: 30, vencido: 50, medicion_ans_id: Types.MINUTES.value }));
        const shift = new ShiftManagement(ShiftManagementMother.diasLaborablesLunesDomingo24Horas());

        const expirationCalculator = new ExpirationCalculator({ ans, shift }, currentDate, createdAt);

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansMinutos antes de finalizar la jornada', () => {
        const createdAt = ansDate('2025-04-01 16:30');
        const currentDate = ansDate('2025-04-02 09:10');
        const expireAt = '2025-04-02 09:20';

        const expirationCalculator = new ExpirationCalculator(
            ansCase(createdAt, { intermedio: 30, vencido: 50, medicion_ans_id: 'Minutes' }),
            currentDate,
            createdAt
        );

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansMinutos previo a iniciar la jornada', () => {
        const createdAt = ansDate('2023-02-01 07:30');
        const expireAt = '2023-02-01 09:50';
        const currentDate = ansDate('2023-02-01 09:15');

        const expirationCalculator = new ExpirationCalculator(
            ansCase(createdAt, { intermedio: 30, vencido: 50, medicion_ans_id: 'Minutes' }),
            currentDate,
            createdAt
        );

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansMinutos caso creado a despues del cierre de jornada', () => {
        const createdAt = ansDate('2023-02-01 18:30');
        const expireAt = '2023-02-02 09:50';
        const currentDate = ansDate('2023-02-02 09:40');

        const expirationCalculator = new ExpirationCalculator(
            ansCase(createdAt, { intermedio: 30, vencido: 50, medicion_ans_id: 'Minutes' }),
            currentDate,
            createdAt
        );

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener tiempo restante para el vencimiento de ansMinutos despues del cierre de jornada', () => {
        const createdAt = ansDate('2023-02-01 16:30');
        const expireAt = '2023-02-02 09:20';
        const currentDate = ansDate('2023-02-01 22:00');

        const expirationCalculator = new ExpirationCalculator(
            ansCase(createdAt, { intermedio: 30, vencido: 50, medicion_ans_id: 'Minutes' }),
            currentDate,
            createdAt
        );

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansHoras dentro de la jornada laboral', () => {
        const createdAt = ansDate('2023-02-01 10:00');
        const expireAt = '2023-02-01 17:00';
        const currentDate = ansDate('2023-02-01 11:00');

        const expirationCalculator = new ExpirationCalculator(
            ansCase(createdAt, { intermedio: 4, vencido: 7, medicion_ans_id: 'Hours' }),
            currentDate,
            createdAt
        );

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansHoras faltando minutos', () => {
        const createdAt = ansDate('2023-02-01 08:30');
        const expireAt = '2023-02-01 17:00';
        const currentDate = ansDate('2023-02-01 16:15');

        const expirationCalculator = new ExpirationCalculator(
            ansCase(createdAt, { intermedio: 4, vencido: 8, medicion_ans_id: 'Hours' }),
            currentDate,
            createdAt
        );

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansHoras antes de finalizar la jornada laboral', () => {
        const createdAt = ansDate('2023-02-01 14:00');
        const expireAt = '2023-02-02 14:00';
        const currentDate = ansDate('2023-02-02 09:00');

        const expirationCalculator = new ExpirationCalculator(
            ansCase(createdAt, { intermedio: 4, vencido: 8, medicion_ans_id: 'Hours' }),
            currentDate,
            createdAt
        );

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansHoras previo al iniciar la jornada laboral', () => {
        const createdAt = ansDate('2023-02-01 06:00');
        const expireAt = '2023-02-01 17:00';
        const currentDate = ansDate('2023-02-01 10:00');

        const expirationCalculator = new ExpirationCalculator(
            ansCase(createdAt, { intermedio: 4, vencido: 8, medicion_ans_id: 'Hours' }),
            currentDate,
            createdAt
        );

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansHoras caso creado a despues del cierre de jornada', () => {
        const createdAt = ansDate('2023-02-01 19:00');
        const expireAt = '2023-02-02 17:00';
        const currentDate = ansDate('2023-02-02 09:00');

        const expirationCalculator = new ExpirationCalculator(
            ansCase(createdAt, { intermedio: 4, vencido: 8, medicion_ans_id: 'Hours' }),
            currentDate,
            createdAt
        );

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener tiempo restante para el vencimiento de ansHoras despues del cierre de jornada', () => {
        const createdAt = ansDate('2023-02-01 19:00');
        const expireAt = '2023-02-02 17:00';
        const currentDate = ansDate('2023-02-01 22:00');

        const expirationCalculator = new ExpirationCalculator(
            ansCase(createdAt, { intermedio: 4, vencido: 8, medicion_ans_id: 'Hours' }),
            currentDate,
            createdAt
        );

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansDias dentro de la jornada laboral', () => {
        const createdAt = ansDate('2023-02-01 13:00');
        const expireAt = '2023-02-09 13:00';
        const currentDate = ansDate('2023-02-05 09:32');

        const ans = { intermedio: 4, vencido: 8, medicion_ans_id: 'Days' };
        const shift = { work_days: shiftAllDaysOfWeek };

        const expirationCalculator = new ExpirationCalculator(ansCase(createdAt, ans, shift), currentDate, createdAt);

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansDias antes de finalizar la jornada laboral', () => {
        const createdAt = ansDate('2023-02-01 16:59');
        const expireAt = '2023-02-09 16:59';
        const currentDate = ansDate('2023-02-02 16:58');

        const ans = { intermedio: 4, vencido: 8, medicion_ans_id: 'Days' };
        const shift = { work_days: shiftAllDaysOfWeek };

        const expirationCalculator = new ExpirationCalculator(ansCase(createdAt, ans, shift), currentDate, createdAt);

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansDias previo al iniciar la jornada laboral', () => {
        const createdAt = ansDate('2023-02-01 07:00');
        const expireAt = '2023-02-09 09:00';
        const currentDate = ansDate('2023-02-06 09:32');

        const ans = { intermedio: 4, vencido: 8, medicion_ans_id: 'Days' };
        const shift = { work_days: shiftAllDaysOfWeek };

        const expirationCalculator = new ExpirationCalculator(ansCase(createdAt, ans, shift), currentDate, createdAt);

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansDias caso creado a despues del cierre de jornada', () => {
        const createdAt = ansDate('2023-02-01 19:00');
        const expireAt = '2023-02-10 09:00';
        const currentDate = ansDate('2023-02-09 09:32');

        const ans = { intermedio: 4, vencido: 8, medicion_ans_id: 'Days' };
        const shift = { work_days: shiftAllDaysOfWeek };

        const expirationCalculator = new ExpirationCalculator(ansCase(createdAt, ans, shift), currentDate, createdAt);

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener el tiempo restante antes del vencimiento de ansDias creado dentro de la jornada laboral', () => {
        const createdAt = ansDate('2023-02-01 10:32');
        const expireAt = '2023-02-13 10:32';
        const currentDate = ansDate('2023-02-06 09:32');

        const expirationCalculator = new ExpirationCalculator(
            ansCase(createdAt, { intermedio: 4, vencido: 8, medicion_ans_id: 'Days' }),
            currentDate,
            createdAt
        );

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener el tiempo restante para su vencimiento de ansDias en sabado no laboral', () => {
        const createdAt = ansDate('2023-02-01 10:32');
        const expireAt = '2023-02-13 10:32';
        const currentDate = ansDate('2023-02-04 11:32');

        const expirationCalculator = new ExpirationCalculator(
            ansCase(createdAt, { intermedio: 4, vencido: 8, medicion_ans_id: 'Days' }),
            currentDate,
            createdAt
        );

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansDias incluyendo un dia festivo', () => {
        const createdAt = ansDate('2023-02-01 10:32');
        const expireAt = '2023-02-14 10:32';
        const currentDate = ansDate('2023-02-03 09:32');
        const holiday_dates = ['2023-02-06'];

        const expirationCalculator = new ExpirationCalculator(
            ansCase(createdAt, { intermedio: 4, vencido: 8, medicion_ans_id: 'Days' }, { holiday_dates }),
            currentDate,
            createdAt
        );

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener la fecha de vencimiento de ansDias incluyendo un dia festivo hora posterior a la creacion', () => {
        const createdAt = ansDate('2023-02-01 10:32');
        const expireAt = '2023-02-14 10:32';
        const currentDate = ansDate('2023-02-03 15:00');
        const holiday_dates = ['2023-02-06'];

        const ans = { intermedio: 4, vencido: 8, medicion_ans_id: 'Days' };
        const shift = { holiday_dates };

        const expirationCalculator = new ExpirationCalculator(ansCase(createdAt, ans, shift), currentDate, createdAt);

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });

    it('obtener el tiempo restante antes del vencimiento de ansDias despues del cierre de jornada', () => {
        const createdAt = ansDate('2023-02-01 19:00');
        const expireAt = '2023-02-10 09:00';
        const currentDate = ansDate('2023-02-08 22:00');

        const ans = { intermedio: 4, vencido: 8, medicion_ans_id: 'Days' };
        const shift = { work_days: shiftAllDaysOfWeek };

        const expirationCalculator = new ExpirationCalculator(ansCase(createdAt, ans, shift), currentDate, createdAt);

        expect(formatAnsDate(expirationCalculator.expiredAt)).toBe(expireAt);
    });
});
