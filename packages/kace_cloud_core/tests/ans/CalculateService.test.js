import { jest } from '@jest/globals';
import { KnexAnsRepository, Types, CalculateService } from '../../src/ans/index.js';
import { knexConfig } from '../knexfile.js';
import AnsMother from './domain/AnsMother.js';
import CasesMother from '../cases/domain/CasesMother.js';
import ClassificationsMother from '../classifications/domain/ClassificationsMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import ShiftManagementMother from '../shift-management/domain/ShiftManagementMother.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { KnexClassificationRepository } from '../../src/classifications/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import createDayjsInstance from '../../src/shared/factories/DayjsFactory.js';
import { TransitionsMother } from '../transition/domain/TransitionsMother.js';
import { KnexTransitionsRepository } from '../../src/transition/index.js';

const dayjs = createDayjsInstance({
    useTimezoneByDefault: false,
});

const repository = new KnexCaseRepository(knexConfig);
const ansRepository = new KnexAnsRepository(repository.connection);
const classificationRepository = new KnexClassificationRepository(repository.connection);
const groupsRepository = new KnexGroupsRepository(repository.connection);
const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
const caseRepository = new KnexCaseRepository(repository.connection);
const calculateService = new CalculateService(repository, ansRepository, shiftManagementRepository);
const transitionsRepository = new KnexTransitionsRepository(repository.connection);

const getWorkDays = (workStart = '08:00', includeWeekends = true, workEnd = null) => {
    const computedWorkEnd = workEnd ?? dayjs(`1970-01-01T${workStart}:00`).utc(true).add(8, 'hours').format('HH:mm');

    const baseWorkDays = {
        monday: { end: computedWorkEnd, start: workStart },
        tuesday: { end: computedWorkEnd, start: workStart },
        wednesday: { end: computedWorkEnd, start: workStart },
        thursday: { end: computedWorkEnd, start: workStart },
        friday: { end: computedWorkEnd, start: workStart },
    };

    if (includeWeekends) {
        baseWorkDays.saturday = { end: computedWorkEnd, start: workStart };
        baseWorkDays.sunday = { end: computedWorkEnd, start: workStart };
    }

    return baseWorkDays;
};

const createCase = async ({
    medicionAnsId = Types.DAYS.value,
    ansValues = { intermedio: 12, vencido: 24 },
    caseValues = {},
    workStart,
    includeWeekends,
    workEnd,
    holidayDates = [],
    enableTransitionAns = true,
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
        intermedio: 2,
        vancido: 4,
        medicion_ans_id: Types.HOURS.value,
    });

    const transitions = await TransitionsMother.createRandomTransition(transitionsRepository, {
        ans_id: enableTransitionAns ? transitionAns.id.value : null,
    });

    return await CasesMother.createCase(caseRepository, {
        clasificacion_id: classification.id.value,
        grupo_id: group.id.value,
        fecha_resolucion: null,
        transicion_id: transitions.id.value,
        created_at: Date.now(),
        ...caseValues,
    });
};

// CalcularCasosAnsTest.php
describe('AnsCalculatorService -> Cases', () => {
    const countUnresolvedCases = async (medicionAnsId) => {
        const numberOfUnresolvedCases = await repository
            .connection('cases')
            .whereNull('fecha_resolucion')
            .join('clasificaciones', 'cases.clasificacion_id', 'clasificaciones.id')
            .join('ans', 'clasificaciones.ans_id', 'ans.id')
            .where('ans.medicion_ans_id', medicionAnsId)
            .count('* as total')
            .first();

        return numberOfUnresolvedCases.total ?? 0;
    };

    it('should calculate cases for days', async () => {
        const unresolvedCases = await countUnresolvedCases(Types.DAYS.value);

        await createCase({
            medicionAnsId: Types.DAYS.value,
            ansValues: {
                intermedio: 2,
                vencido: 4,
            },
        });

        const response = await calculateService.execute(Types.DAYS.value);

        expect(response.processedCases).toEqual(Number(unresolvedCases) + 1);
    });

    it('should calculate cases for hours', async () => {
        const unresolvedCases = await countUnresolvedCases(Types.HOURS.value);

        await createCase({
            medicionAnsId: Types.HOURS.value,
            ansValues: {
                intermedio: 2,
                vencido: 4,
            },
        });

        const response = await calculateService.execute(Types.HOURS.value);

        expect(response.processedCases).toEqual(Number(unresolvedCases) + 1);
    });

    it('should calculate cases for minutes', async () => {
        const unresolvedCases = await countUnresolvedCases(Types.MINUTES.value);

        await createCase({
            medicionAnsId: Types.MINUTES.value,
            ansValues: {
                intermedio: 2,
                vencido: 4,
            },
        });

        const response = await calculateService.execute(Types.MINUTES.value);

        expect(response.processedCases).toEqual(Number(unresolvedCases) + 1);
    });

    it('should update all ans and sla cases fields', async () => {
        await createCase({
            medicionAnsId: Types.DAYS.value,
            ansValues: {
                intermedio: 2,
                vencido: 4,
            },
        });

        await calculateService.execute(Types.DAYS.value);

        const kase = await repository.connection(repository.tableName).select('*');

        expect(typeof kase[0].antiguedad).toBe('string');
        expect(typeof kase[0].ans_posicion).toBe('number');
        expect(typeof kase[0].antiguedad_dias).toBe('number');
        expect(typeof kase[0].antiguedad_horas).toBe('number');
        expect(typeof kase[0].antiguedad_minutos).toBe('number');

        expect(typeof kase[0].state_elapsed_time).toBe('string');
        expect(typeof kase[0].state_elapsed_days).toBe('number');
        expect(typeof kase[0].state_elapsed_hours).toBe('number');
        expect(typeof kase[0].state_elapsed_minutes).toBe('number');

        // `expired_at`, `sla_due_date` y `sla_state_due_date` son columnas
        // `timestamp`: el driver `pg` las devuelve como `Date`, no como cadena.
        expect(kase[0].expired_at).toBeInstanceOf(Date);
        expect(typeof kase[0].remaining_time).toBe('string');

        expect(typeof kase[0].sla_position).toBe('number');
        expect(typeof kase[0].sla_elapsed_time).toBe('string');
        expect(typeof kase[0].sla_elapsed_days).toBe('number');
        expect(typeof kase[0].sla_elapsed_hours).toBe('number');
        expect(typeof kase[0].sla_elapsed_minutes).toBe('number');

        expect(typeof kase[0].sla_state_position).toBe('number');
        expect(typeof kase[0].sla_state_elapsed_time).toBe('string');
        expect(typeof kase[0].sla_state_elapsed_days).toBe('number');
        expect(typeof kase[0].sla_state_elapsed_hours).toBe('number');
        expect(typeof kase[0].sla_state_elapsed_minutes).toBe('number');

        expect(kase[0].sla_due_date).toBeInstanceOf(Date);
        expect(typeof kase[0].sla_remaining_time).toBe('string');
        expect(typeof kase[0].sla_remaining_days).toBe('number');
        expect(typeof kase[0].sla_remaining_hours).toBe('number');
        expect(typeof kase[0].sla_remaining_minutes).toBe('number');

        expect(kase[0].sla_state_due_date).toBeInstanceOf(Date);
        expect(typeof kase[0].sla_state_remaining_time).toBe('string');
        expect(typeof kase[0].sla_state_remaining_days).toBe('number');
        expect(typeof kase[0].sla_state_remaining_hours).toBe('number');
        expect(typeof kase[0].sla_state_remaining_minutes).toBe('number');
    });

    it('should update all ans and sla cases fields whitout transition ANS', async () => {
        await createCase({
            medicionAnsId: Types.DAYS.value,
            ansValues: {
                intermedio: 2,
                vencido: 4,
            },
            workStart: '08:00',
            workEnd: '18:00',
            includeWeekends: true,
            enableTransitionAns: false,
        });

        await calculateService.execute(Types.DAYS.value);

        const kase = await repository.connection(repository.tableName).select('*');

        expect(typeof kase[0].antiguedad).toBe('string');
        expect(typeof kase[0].ans_posicion).toBe('number');
        expect(typeof kase[0].antiguedad_dias).toBe('number');
        expect(typeof kase[0].antiguedad_horas).toBe('number');
        expect(typeof kase[0].antiguedad_minutos).toBe('number');

        expect(typeof kase[0].state_elapsed_time).toBe('string');
        expect(typeof kase[0].state_elapsed_days).toBe('number');
        expect(typeof kase[0].state_elapsed_hours).toBe('number');
        expect(typeof kase[0].state_elapsed_minutes).toBe('number');

        // `expired_at`, `sla_due_date` y `sla_state_due_date` son columnas
        // `timestamp`: el driver `pg` las devuelve como `Date`, no como cadena.
        expect(kase[0].expired_at).toBeInstanceOf(Date);
        expect(typeof kase[0].remaining_time).toBe('string');

        expect(typeof kase[0].sla_position).toBe('number');
        expect(typeof kase[0].sla_elapsed_time).toBe('string');
        expect(typeof kase[0].sla_elapsed_days).toBe('number');
        expect(typeof kase[0].sla_elapsed_hours).toBe('number');
        expect(typeof kase[0].sla_elapsed_minutes).toBe('number');

        expect(typeof kase[0].sla_state_position).toBe('number');
        expect(typeof kase[0].sla_state_elapsed_time).toBe('string');
        expect(typeof kase[0].sla_state_elapsed_days).toBe('number');
        expect(typeof kase[0].sla_state_elapsed_hours).toBe('number');
        expect(typeof kase[0].sla_state_elapsed_minutes).toBe('number');

        expect(kase[0].sla_due_date).toBeInstanceOf(Date);
        expect(typeof kase[0].sla_remaining_time).toBe('string');
        expect(typeof kase[0].sla_remaining_days).toBe('number');
        expect(typeof kase[0].sla_remaining_hours).toBe('number');
        expect(typeof kase[0].sla_remaining_minutes).toBe('number');

        expect(kase[0].sla_state_due_date).toBeInstanceOf(Date);
        expect(typeof kase[0].sla_state_remaining_time).toBe('string');
        expect(typeof kase[0].sla_state_remaining_days).toBe('number');
        expect(typeof kase[0].sla_state_remaining_hours).toBe('number');
        expect(typeof kase[0].sla_state_remaining_minutes).toBe('number');
    });
});

// CalcularAntiguedadDeCasoTest.php
describe('AnsCalculatorService -> CalculateAntiquity', () => {
    const createAdjustedDateTime = ({ day = '0 days', hours = 0, minutes = 0, seconds = 0, milliseconds = 0 }) => {
        let date = dayjs().tz();

        const dayMatch = day.match(/^([-+]?\d+)\s*days?$/);
        if (dayMatch) {
            const dayOffset = parseInt(dayMatch[1], 10);
            date = date.add(dayOffset, 'day');
        }

        return date.hour(hours).minute(minutes).second(seconds).millisecond(milliseconds);
    };

    const expectAntiquity = async (kase, expectedAntiquity) => {
        const updatedCase = await caseRepository.find(kase.id);

        expect(updatedCase.antiguedad_dias.value).toEqual(expectedAntiquity.days);
        expect(updatedCase.antiguedad_horas.value).toEqual(expectedAntiquity.hours);
        expect(updatedCase.antiguedad_minutos.value).toEqual(expectedAntiquity.minutes);
    };

    //creado_dentro_del_horario_laboral
    it('should create during working hours', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 8, minutes: 20 });
        const createdAt = createAdjustedDateTime({ hours: 8, minutes: 10 }).toDate();

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.MINUTES.value,
            workStart: '08:00',
        });

        await calculateService.execute(Types.MINUTES.value, currentDateTime);
        await expectAntiquity(kase, { days: 0, hours: 0, minutes: 10 });
    });

    //creado_antes_del_horario_laboral_pero_ya_se_inicio_labores
    it('should create before working hours but already started working', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 8, minutes: 10 });
        const createdAt = createAdjustedDateTime({ hours: 7, minutes: 40 }).toDate();

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.MINUTES.value,
            workStart: '08:00',
        });

        await calculateService.execute(Types.MINUTES.value, currentDateTime);
        await expectAntiquity(kase, { days: 0, hours: 0, minutes: 10 });
    });

    //creado_antes_del_horario_laboral_aun_no_se_inicia_labores
    it('should create before working hours and not started working', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 7, minutes: 50 });
        const createdAt = createAdjustedDateTime({ hours: 7, minutes: 40 }).toDate();

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.MINUTES.value,
            workStart: '08:00',
        });

        await calculateService.execute(Types.MINUTES.value, currentDateTime);
        await expectAntiquity(kase, { days: 0, hours: 0, minutes: 0 });
    });

    //creado_despues_del_horario_laboral
    it('should create after working hours', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 18, minutes: 10 });
        const createdAt = createAdjustedDateTime({ hours: 18, minutes: 20 }).toDate();

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.MINUTES.value,
            workStart: '08:00',
        });

        await calculateService.execute(Types.MINUTES.value, currentDateTime);
        await expectAntiquity(kase, { days: 0, hours: 0, minutes: 0 });
    });

    //creado_un_dia_antes_dentro_del_horario_laboral___horaActual_mayor_que_horaCreacion
    it('should create a day before during working hours', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 12, minutes: 0 });
        const createdAt = createAdjustedDateTime({
            day: '-1 day',
            hours: 9,
            minutes: 0,
        }).toDate();

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.MINUTES.value,
            workStart: '08:00',
        });

        await calculateService.execute(Types.MINUTES.value, currentDateTime);
        await expectAntiquity(kase, { days: 1, hours: 3, minutes: 0 });
    });

    // creado_dos_dias_antes_dentro_del_horario_laboral
    it('should create two days before during working hours', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 10, minutes: 30 });
        const createdAt = createAdjustedDateTime({
            day: '-2 days',
            hours: 9,
            minutes: 20,
        }).toDate();

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.MINUTES.value,
            workStart: '08:00',
        });

        await calculateService.execute(Types.MINUTES.value, currentDateTime);
        await expectAntiquity(kase, { days: 2, hours: 1, minutes: 10 });
    });

    //creado_dos_dias_antes_dentro_de_horario_laboral___hora_actual_pos_horario_laboral
    it('should set the creation timestamp to two days earlier when created within business hours, with the current time after working hours', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 20, minutes: 0 });
        const createdAt = createAdjustedDateTime({
            day: '-2 days',
            hours: 9,
            minutes: 0,
        }).toDate();

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.MINUTES.value,
            workStart: '08:00',
        });

        await calculateService.execute(Types.MINUTES.value, currentDateTime);
        await expectAntiquity(kase, { days: 2, hours: 7, minutes: 0 });
    });

    //creado_dos_dias_antes_fuera_de_horario_laboral
    it('should set the creation timestamp to two days earlier when created outside business hours', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 10, minutes: 0 });
        const createdAt = createAdjustedDateTime({
            day: '-2 days',
            hours: 20,
            minutes: 0,
        }).toDate();

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.MINUTES.value,
            workStart: '08:00',
        });

        await calculateService.execute(Types.MINUTES.value, currentDateTime);
        await expectAntiquity(kase, { days: 1, hours: 2, minutes: 0 });
    });

    //creado_dos_dias_antes_fuera_de_horario_laboral___hora_actual_pos_horario_laboral
    it('should set the creation timestamp to two days earlier when created outside business hours, with the current time after working hours', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 20, minutes: 0 });
        const createdAt = createAdjustedDateTime({
            day: '-2 days',
            hours: 20,
            minutes: 0,
        }).toDate();

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.MINUTES.value,
            workStart: '08:00',
        });

        await calculateService.execute(Types.MINUTES.value, currentDateTime);
        await expectAntiquity(kase, { days: 2, hours: 0, minutes: 0 });
    });

    //creado_dentro_del_horario_laboral_jornada_24_horas
    it('should create during working hours 24 hours', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 12, minutes: 50 });
        const createdAt = createAdjustedDateTime({ hours: 8, minutes: 30 }).toDate();

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.MINUTES.value,
            workStart: '00:00',
            workEnd: '23:59',
        });

        await calculateService.execute(Types.MINUTES.value, currentDateTime);
        await expectAntiquity(kase, { days: 0, hours: 4, minutes: 20 });
    });

    //creado_dos_dias_antes_jornada_24
    it('should create two days before 24 hours', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 12, minutes: 0 });
        const createdAt = createAdjustedDateTime({ day: '-2 days', hours: 22, minutes: 0 }).toDate();

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.MINUTES.value,
            workStart: '00:00',
            workEnd: '23:59',
        });

        await calculateService.execute(Types.MINUTES.value, currentDateTime);
        await expectAntiquity(kase, { days: 1, hours: 14, minutes: 0 });
    });

    //creado_un_dia_antes_jornada_24
    it('should create a day before 24 hours', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 12, minutes: 0 });
        const createdAt = createAdjustedDateTime({ day: '-1 days', hours: 22, minutes: 0 }).toDate();

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.MINUTES.value,
            workStart: '00:00',
            workEnd: '23:59',
        });

        await calculateService.execute(Types.MINUTES.value, currentDateTime);
        await expectAntiquity(kase, { days: 0, hours: 14, minutes: 0 });
    });

    //creado_cinco_dias_antes_dentro_del_horario_laboral_con_1_dia_festivo
    it('should create five days before during working hours with one holiday', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 10, minutes: 0 });
        const createdAt = createAdjustedDateTime({
            day: '-5 days',
            hours: 9,
            minutes: 0,
        }).toDate();
        const holidayDate = createAdjustedDateTime({ day: '-2 days' }).toDate().toISOString().split('T')[0];

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.MINUTES.value,
            workStart: '08:00',
            holidayDates: [holidayDate],
        });

        await calculateService.execute(Types.MINUTES.value, currentDateTime);
        await expectAntiquity(kase, { days: 4, hours: 1, minutes: 0 });
    });

    //creado_dentro_del_horario_laboral_de_lunes_a_viernes
    it('should create during working hours from Monday to Friday', async () => {
        const currentDateTime = createAdjustedDateTime({ hours: 8, minutes: 0 }).year(2022).month(8).date(5);
        const createdAt = createAdjustedDateTime({ hours: 9, minutes: 0 }).year(2022).month(7).date(29).toDate();

        const kase = await createCase({
            caseValues: {
                created_at: createdAt,
            },
            medicionAnsId: Types.DAYS.value,
            workStart: '08:00',
            includeWeekends: false,
        });

        await calculateService.execute(Types.DAYS.value, currentDateTime);
        await expectAntiquity(kase, { days: 4, hours: 7, minutes: 0 });
    });
});

describe('CalculateService.execute — chunked iteration (unit)', () => {
    const makeMockRow = (id) => ({
        kase: {
            id: { value: id },
            // Pre-set changedAttributes — production code in this case path will NOT
            // re-run UpdateSLATimers because relations (caseAns, shiftManagement) are null.
            changedAttributes: { sla_elapsed_time: `t-${id}` },
        },
        caseAns: null,
        shiftManagement: null,
        stateAns: null,
        globalConfig: null,
    });

    const makeMockRepo = (pages) => {
        let call = 0;
        return {
            findUnresolvedByMeasurementTypePaginated: jest.fn().mockImplementation(async () => {
                const page = pages[call] ?? [];
                call += 1;
                return page;
            }),
            bulkUpdateSlaTimers: jest.fn().mockResolvedValue(undefined),
        };
    };

    it('returns 0 processed cases when no chunks come back', async () => {
        const repo = makeMockRepo([[]]);
        const svc = new CalculateService(repo);
        const result = await svc.execute(Types.MINUTES.value);
        expect(result.processedCases).toBe(0);
        expect(repo.bulkUpdateSlaTimers).not.toHaveBeenCalled();
    });

    it('iterates 3 full chunks + 1 partial chunk and stops on empty', async () => {
        const pages = [
            Array.from({ length: 1000 }, (_, i) => makeMockRow(`a-${i}`)),
            Array.from({ length: 1000 }, (_, i) => makeMockRow(`b-${i}`)),
            Array.from({ length: 1000 }, (_, i) => makeMockRow(`c-${i}`)),
            Array.from({ length: 500 }, (_, i) => makeMockRow(`d-${i}`)),
            [],
        ];
        const repo = makeMockRepo(pages);
        const svc = new CalculateService(repo);

        const result = await svc.execute(Types.MINUTES.value);

        expect(result.processedCases).toBe(3500);
        expect(repo.bulkUpdateSlaTimers).toHaveBeenCalledTimes(4);
        expect(repo.bulkUpdateSlaTimers.mock.calls[0][0].length).toBe(1000);
        expect(repo.bulkUpdateSlaTimers.mock.calls[3][0].length).toBe(500);
    });

    it('skips bulkUpdateSlaTimers for chunks where every row has empty changedAttributes', async () => {
        const rowsNoChanges = Array.from({ length: 10 }, (_, i) => ({
            kase: { id: { value: `x-${i}` }, changedAttributes: {} },
            caseAns: null,
            shiftManagement: null,
            stateAns: null,
            globalConfig: null,
        }));
        const repo = makeMockRepo([rowsNoChanges, []]);
        const svc = new CalculateService(repo);

        const result = await svc.execute(Types.MINUTES.value);

        expect(result.processedCases).toBe(10);
        expect(repo.bulkUpdateSlaTimers).not.toHaveBeenCalled();
    });

    it('advances the cursor to the last id of the previous chunk', async () => {
        const page1 = [makeMockRow('id-1'), makeMockRow('id-2'), makeMockRow('id-3')];
        const repo = makeMockRepo([page1, []]);
        const svc = new CalculateService(repo);

        await svc.execute(Types.MINUTES.value);

        const calls = repo.findUnresolvedByMeasurementTypePaginated.mock.calls;
        expect(calls[0][0].afterId).toBeNull();
        expect(calls[1][0].afterId).toBe('id-3');
    });

    it('propagates errors from bulkUpdateSlaTimers and stops iterating', async () => {
        const page1 = [makeMockRow('a')];
        const page2 = [makeMockRow('b')];
        const repo = {
            findUnresolvedByMeasurementTypePaginated: jest
                .fn()
                .mockResolvedValueOnce(page1)
                .mockResolvedValueOnce(page2),
            bulkUpdateSlaTimers: jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('db boom')),
        };
        const svc = new CalculateService(repo);

        await expect(svc.execute(Types.MINUTES.value)).rejects.toThrow('db boom');
        expect(repo.findUnresolvedByMeasurementTypePaginated).toHaveBeenCalledTimes(2);
    });

    it('yields the event loop within a chunk so a large chunk does not block it', async () => {
        // Regression: the synchronous per-case SLA calculation over a 1000-row chunk froze the
        // single Node event loop for ~165s, starving the /health probe and tripping the ECS
        // health check. The inner loop must cooperatively yield so other I/O can run.
        const spy = jest.spyOn(global, 'setImmediate');
        try {
            const rows = Array.from({ length: 200 }, (_, i) => makeMockRow(`y-${i}`));
            const repo = makeMockRepo([rows, []]);
            const svc = new CalculateService(repo);

            const before = spy.mock.calls.length;
            await svc.execute(Types.MINUTES.value);
            const yields = spy.mock.calls.length - before;

            // 200 rows with a yield every 50 → at least 3 cooperative yields within the chunk.
            expect(yields).toBeGreaterThanOrEqual(3);
        } finally {
            spy.mockRestore();
        }
    });
});
