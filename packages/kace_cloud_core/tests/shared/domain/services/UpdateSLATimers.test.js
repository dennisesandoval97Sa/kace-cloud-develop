import CasesMother from '../../../cases/domain/CasesMother';
import { UpdateSLATimers } from '../../../../src/shared/domain/services/UpdateSLATimers';
import { KnexAnsRepository, Types } from '../../../../src/ans/index.js';
import AnsMother from '../../../ans/domain/AnsMother.js';
import ClassificationsMother from '../../../classifications/domain/ClassificationsMother.js';
import ShiftManagementMother from '../../../shift-management/domain/ShiftManagementMother.js';
import { GroupsMother } from '../../../grupos/domain/GroupsMother.js';
import { TransitionsMother } from '../../../transition/domain/TransitionsMother.js';
import { knexConfig } from '../../../knexfile.js';
import { KnexCaseRepository } from '../../../../src/cases/index.js';
import { KnexClassificationRepository } from '../../../../src/classifications/index.js';
import { KnexShiftManagementRepository } from '../../../../src/shift-management/index.js';
import { KnexGroupsRepository } from '../../../../src/grupos/index.js';
import { KnexTransitionsRepository } from '../../../../src/transition/index.js';
import { expect } from '@jest/globals';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { GlobalConfigurationsMother } from '../../../global-config/domain/GlobalConfigurationsMother.js';
import { KnexGlobalConfigurationRepository } from '../../../../src/global-config/index.js';
import { SETTINGS_UPDATED_AT_6_OCTOBER_2025 } from '../../../global-config/domain/SettingsMother.js';

dayjs.extend(utc);

describe('UpdateSLATimers.test', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const ansRepository = new KnexAnsRepository(caseRepository.connection);
    const classificationRepository = new KnexClassificationRepository(caseRepository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(caseRepository.connection);
    const groupsRepository = new KnexGroupsRepository(caseRepository.connection);
    const transitionsRepository = new KnexTransitionsRepository(caseRepository.connection);
    const globalConfigurationRepository = new KnexGlobalConfigurationRepository(caseRepository.connection);

    const getWorkDays = (workStart = '08:00', includeWeekends = true, workEnd = null) => {
        const computedWorkEnd =
            workEnd ?? dayjs(`1970-01-01T${workStart}:00`).utc(true).add(8, 'hours').format('HH:mm');

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

    /**
     * @description create a case with the given parameters
     * @param medicionAnsId
     * @param ansValues
     * @param ansTransitionValues
     * @param caseValues
     * @param workStart
     * @param includeWeekends
     * @param workEnd
     * @param holidayDates
     * @returns {Promise<{kase: Case, caseAns: Ans, shiftManagement: ShiftManagement, stateAns: Ans}>}
     */
    const createCase = async ({
        medicionAnsId = Types.MINUTES.value,
        ansValues = { intermedio: 30, vencido: 60 },
        ansTransitionValues = { intermedio: 10, vencido: 20 },
        caseValues = {},
        workStart,
        includeWeekends,
        workEnd,
        holidayDates = [],
        calculateUsingDueDate = false,
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

        let group;
        const configuration = await GlobalConfigurationsMother.createConfiguration(globalConfigurationRepository, {
            settings: SETTINGS_UPDATED_AT_6_OCTOBER_2025,
        });
        if (calculateUsingDueDate) {
            /** @type {GlobalConfiguration} */
            let settings = configuration.settings.value;
            settings.behaviors.application.agente.casos.due_date_for_ans_calculation = true;
            configuration.settings = settings;
            await globalConfigurationRepository.update(configuration);
        }

        group = await GroupsMother.createWithCustomShiftManagementAndConfig(
            groupsRepository,
            shiftManagement,
            configuration
        );

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

        let settings = configuration.settings.value;
        return {
            kase: kase,
            caseAns: ans,
            shiftManagement: shiftManagement,
            stateAns: transitionAns,
            globalConfig: settings,
        };
    };

    it('sould update CaseAns aggregate with SLA ', async () => {
        const { kase, caseAns, shiftManagement, stateAns, globalConfig } = await createCase({});

        const updateSLATimers = new UpdateSLATimers(kase, shiftManagement, caseAns, stateAns, globalConfig);

        const SLAFieldsUpdated = updateSLATimers.execute();

        expect(typeof SLAFieldsUpdated.antiguedad.value).toBe('string');
        expect(typeof SLAFieldsUpdated.ans_posicion.value).toBe('number');
        expect(typeof SLAFieldsUpdated.antiguedad_dias.value).toBe('number');
        expect(typeof SLAFieldsUpdated.antiguedad_horas.value).toBe('number');
        expect(typeof SLAFieldsUpdated.antiguedad_minutos.value).toBe('number');

        expect(typeof SLAFieldsUpdated.state_elapsed_time.value).toBe('string');
        expect(typeof SLAFieldsUpdated.state_elapsed_days.value).toBe('number');
        expect(typeof SLAFieldsUpdated.state_elapsed_hours.value).toBe('number');
        expect(typeof SLAFieldsUpdated.state_elapsed_minutes.value).toBe('number');

        expect(typeof SLAFieldsUpdated.expired_at.value).toBe('string');
        expect(typeof SLAFieldsUpdated.remaining_time.value).toBe('string');

        expect(typeof SLAFieldsUpdated.sla_position.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_elapsed_time.value).toBe('string');
        expect(typeof SLAFieldsUpdated.sla_elapsed_days.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_elapsed_hours.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_elapsed_minutes.value).toBe('number');

        expect(typeof SLAFieldsUpdated.sla_state_position.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_state_elapsed_time.value).toBe('string');
        expect(typeof SLAFieldsUpdated.sla_state_elapsed_days.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_state_elapsed_hours.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_state_elapsed_minutes.value).toBe('number');

        expect(typeof SLAFieldsUpdated.sla_due_date.value).toBe('string');
        expect(typeof SLAFieldsUpdated.sla_remaining_time.value).toBe('string');
        expect(typeof SLAFieldsUpdated.sla_remaining_days.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_remaining_hours.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_remaining_minutes.value).toBe('number');

        expect(typeof SLAFieldsUpdated.sla_state_due_date.value).toBe('string');
        expect(typeof SLAFieldsUpdated.sla_state_remaining_time.value).toBe('string');
        expect(typeof SLAFieldsUpdated.sla_state_remaining_days.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_state_remaining_hours.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_state_remaining_minutes.value).toBe('number');
    });

    it('sould update CaseAns aggregate without SLA transitions field', async () => {
        const { kase, caseAns, shiftManagement, stateAns, globalConfig } = await createCase({});

        const updateSLATimers = new UpdateSLATimers(kase, shiftManagement, caseAns, stateAns, globalConfig);

        const SLAFieldsUpdated = updateSLATimers.execute();

        expect(typeof SLAFieldsUpdated.antiguedad.value).toBe('string');
        expect(typeof SLAFieldsUpdated.ans_posicion.value).toBe('number');
        expect(typeof SLAFieldsUpdated.antiguedad_dias.value).toBe('number');
        expect(typeof SLAFieldsUpdated.antiguedad_horas.value).toBe('number');
        expect(typeof SLAFieldsUpdated.antiguedad_minutos.value).toBe('number');

        expect(typeof SLAFieldsUpdated.state_elapsed_time.value).toBe('string');
        expect(typeof SLAFieldsUpdated.state_elapsed_days.value).toBe('number');
        expect(typeof SLAFieldsUpdated.state_elapsed_hours.value).toBe('number');
        expect(typeof SLAFieldsUpdated.state_elapsed_minutes.value).toBe('number');

        expect(typeof SLAFieldsUpdated.expired_at.value).toBe('string');
        expect(typeof SLAFieldsUpdated.remaining_time.value).toBe('string');

        expect(typeof SLAFieldsUpdated.sla_position.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_elapsed_time.value).toBe('string');
        expect(typeof SLAFieldsUpdated.sla_elapsed_days.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_elapsed_hours.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_elapsed_minutes.value).toBe('number');

        expect(typeof SLAFieldsUpdated.sla_state_position.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_state_elapsed_time.value).toBe('string');
        expect(typeof SLAFieldsUpdated.sla_state_elapsed_days.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_state_elapsed_hours.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_state_elapsed_minutes.value).toBe('number');

        expect(typeof SLAFieldsUpdated.sla_due_date.value).toBe('string');
        expect(typeof SLAFieldsUpdated.sla_remaining_time.value).toBe('string');
        expect(typeof SLAFieldsUpdated.sla_remaining_days.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_remaining_hours.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_remaining_minutes.value).toBe('number');

        expect(typeof SLAFieldsUpdated.sla_state_due_date.value).toBe('string');
        expect(typeof SLAFieldsUpdated.sla_state_remaining_time.value).toBe('string');
        expect(typeof SLAFieldsUpdated.sla_state_remaining_days.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_state_remaining_hours.value).toBe('number');
        expect(typeof SLAFieldsUpdated.sla_state_remaining_minutes.value).toBe('number');
    });

    it('case created during working hours', async () => {
        const createdAt = dayjs('2025-10-03 08:10');
        const currentTime = dayjs('2025-10-03 08:20');
        let caseExpiredAt = dayjs('2025-10-03 09:10').utc().toISOString();
        let stateExpiredAt = dayjs('2025-10-03 08:30').utc().toISOString();

        const { kase, caseAns, shiftManagement, stateAns, globalConfig } = await createCase({
            caseValues: {
                created_at: createdAt.toDate(),
                state_change_at: createdAt.toDate(),
            },
            medicionAnsId: Types.MINUTES.value,
            ansValues: { intermedio: 30, vencido: 60 },
            ansTransitionValues: { intermedio: 10, vencido: 20 },
            workStart: '08:00',
            includeWeekends: false,
            workEnd: '18:00',
            holidayDates: ['2025-01-01', '2025-11-20', '2025-12-31'],
        });

        const updateSLATimers = new UpdateSLATimers(kase, shiftManagement, caseAns, stateAns, globalConfig);

        updateSLATimers.execute(currentTime);

        expect(kase.antiguedad.value).toBe('Tiempo laboral transcurrido: 0 días -> 0 horas -> 10 minutos');
        expect(kase.sla_elapsed_time.value).toBe('Tiempo laboral transcurrido: 0 días -> 0 horas -> 10 minutos');

        expect(kase.ans_posicion.value).toBe(1);
        expect(kase.sla_position.value).toBe(1);

        expect(kase.antiguedad_dias.value).toBe(0);
        expect(kase.sla_elapsed_days.value).toBe(0);

        expect(kase.antiguedad_horas.value).toBe(0);
        expect(kase.sla_elapsed_hours.value).toBe(0);

        expect(kase.antiguedad_minutos.value).toBe(10);
        expect(kase.sla_elapsed_minutes.value).toBe(10);

        expect(kase.expired_at.value).toBe(caseExpiredAt);
        expect(kase.sla_due_date.value).toBe(caseExpiredAt);

        expect(kase.remaining_time.value).toBe('Remaining time: 0 days, 0 hours and 50 minutes');
        expect(kase.sla_remaining_time.value).toBe('Remaining time: 0 days, 0 hours and 50 minutes');

        expect(kase.sla_remaining_days.value).toBe(0);
        expect(kase.sla_remaining_hours.value).toBe(0);
        expect(kase.sla_remaining_minutes.value).toBe(50);

        expect(kase.state_elapsed_days.value).toBe(0);
        expect(kase.sla_state_elapsed_days.value).toBe(0);

        expect(kase.state_elapsed_hours.value).toBe(0);
        expect(kase.sla_state_elapsed_hours.value).toBe(0);

        expect(kase.state_elapsed_minutes.value).toBe(10);
        expect(kase.sla_state_elapsed_minutes.value).toBe(10);

        expect(kase.state_elapsed_time.value).toBe('Tiempo laboral transcurrido: 0 días -> 0 horas -> 10 minutos');
        expect(kase.sla_state_elapsed_time.value).toBe('Tiempo laboral transcurrido: 0 días -> 0 horas -> 10 minutos');

        expect(kase.sla_state_position.value).toBe(2);

        expect(kase.sla_state_due_date.value).toBe(stateExpiredAt);
        expect(kase.sla_state_remaining_time.value).toBe('Remaining time: 0 days, 0 hours and 10 minutes');
        expect(kase.sla_state_remaining_days.value).toBe(0);
        expect(kase.sla_state_remaining_hours.value).toBe(0);
        expect(kase.sla_state_remaining_minutes.value).toBe(10);
    });

    it('calculate sla using due_date', async () => {
        const createdAt = dayjs('2025-10-03 08:10');
        const currentTime = dayjs('2025-10-03 08:20');
        let caseExpiredAt = dayjs('2025-10-03 08:25').utc().toISOString();
        let stateExpiredAt = dayjs('2025-10-03 08:30').utc().toISOString();

        const { kase, caseAns, shiftManagement, stateAns, globalConfig } = await createCase({
            caseValues: {
                created_at: createdAt.toDate(),
                state_change_at: createdAt.toDate(),
            },
            medicionAnsId: Types.MINUTES.value,
            ansValues: { intermedio: 30, vencido: 60 },
            ansTransitionValues: { intermedio: 10, vencido: 20 },
            workStart: '08:00',
            includeWeekends: false,
            workEnd: '18:00',
            holidayDates: ['2025-01-01', '2025-11-20', '2025-12-31'],
            calculateUsingDueDate: true,
        });
        kase.sla_due_date = caseExpiredAt;
        await caseRepository.update(kase);

        const updateSLATimers = new UpdateSLATimers(kase, shiftManagement, caseAns, stateAns, globalConfig);

        updateSLATimers.execute(currentTime);

        expect(kase.antiguedad.value).toBe('Tiempo laboral transcurrido: 0 días -> 0 horas -> 10 minutos');
        expect(kase.sla_elapsed_time.value).toBe('Tiempo laboral transcurrido: 0 días -> 0 horas -> 10 minutos');

        expect(kase.ans_posicion.value).toBe(1);
        expect(kase.sla_position.value).toBe(1);

        expect(kase.antiguedad_dias.value).toBe(0);
        expect(kase.sla_elapsed_days.value).toBe(0);

        expect(kase.antiguedad_horas.value).toBe(0);
        expect(kase.sla_elapsed_hours.value).toBe(0);

        expect(kase.antiguedad_minutos.value).toBe(10);
        expect(kase.sla_elapsed_minutes.value).toBe(10);

        expect(kase.expired_at.value).toBe(caseExpiredAt);
        expect(kase.sla_due_date.value).toBe(caseExpiredAt);

        expect(kase.remaining_time.value).toBe('Remaining time: 0 days, 0 hours and 5 minutes');
        expect(kase.sla_remaining_time.value).toBe('Remaining time: 0 days, 0 hours and 5 minutes');

        expect(kase.sla_remaining_days.value).toBe(0);
        expect(kase.sla_remaining_hours.value).toBe(0);
        expect(kase.sla_remaining_minutes.value).toBe(5);

        expect(kase.state_elapsed_days.value).toBe(0);
        expect(kase.sla_state_elapsed_days.value).toBe(0);

        expect(kase.state_elapsed_hours.value).toBe(0);
        expect(kase.sla_state_elapsed_hours.value).toBe(0);

        expect(kase.state_elapsed_minutes.value).toBe(10);
        expect(kase.sla_state_elapsed_minutes.value).toBe(10);

        expect(kase.state_elapsed_time.value).toBe('Tiempo laboral transcurrido: 0 días -> 0 horas -> 10 minutos');
        expect(kase.sla_state_elapsed_time.value).toBe('Tiempo laboral transcurrido: 0 días -> 0 horas -> 10 minutos');

        expect(kase.sla_state_position.value).toBe(2);

        expect(kase.sla_state_due_date.value).toBe(stateExpiredAt);
        expect(kase.sla_state_remaining_time.value).toBe('Remaining time: 0 days, 0 hours and 10 minutes');
        expect(kase.sla_state_remaining_days.value).toBe(0);
        expect(kase.sla_state_remaining_hours.value).toBe(0);
        expect(kase.sla_state_remaining_minutes.value).toBe(10);
    });

    it('should fall back to ExpirationCalculator when due_date_for_ans_calculation is enabled but sla_due_date is null', async () => {
        const createdAt = dayjs('2025-10-03 08:10');
        const currentTime = dayjs('2025-10-03 08:20');

        const { kase, caseAns, shiftManagement, stateAns, globalConfig } = await createCase({
            caseValues: {
                created_at: createdAt.toDate(),
                state_change_at: createdAt.toDate(),
                sla_due_date: null,
            },
            medicionAnsId: Types.MINUTES.value,
            ansValues: { intermedio: 30, vencido: 60 },
            ansTransitionValues: { intermedio: 10, vencido: 20 },
            workStart: '08:00',
            includeWeekends: false,
            workEnd: '18:00',
            calculateUsingDueDate: true,
        });

        expect(kase.sla_due_date.value).toBeNull();

        const updateSLATimers = new UpdateSLATimers(kase, shiftManagement, caseAns, stateAns, globalConfig);

        expect(() => updateSLATimers.execute(currentTime)).not.toThrow();

        expect(kase.sla_due_date.value).not.toBeNull();
        expect(typeof kase.sla_due_date.value).toBe('string');

        expect(kase.expired_at.value).toBe(kase.sla_due_date.value);

        expect(typeof kase.sla_remaining_time.value).toBe('string');
        expect(typeof kase.sla_remaining_days.value).toBe('number');
        expect(typeof kase.sla_remaining_hours.value).toBe('number');
        expect(typeof kase.sla_remaining_minutes.value).toBe('number');
    });

    it('should preserve the existing sla_due_date when due_date_for_ans_calculation is enabled and sla_due_date has a value', async () => {
        const createdAt = dayjs('2025-10-03 08:10');
        const currentTime = dayjs('2025-10-03 08:20');
        const existingDueDate = dayjs('2025-10-03 08:25').utc().toISOString();

        const { kase, caseAns, shiftManagement, stateAns, globalConfig } = await createCase({
            caseValues: {
                created_at: createdAt.toDate(),
                state_change_at: createdAt.toDate(),
            },
            medicionAnsId: Types.MINUTES.value,
            ansValues: { intermedio: 30, vencido: 60 },
            ansTransitionValues: { intermedio: 10, vencido: 20 },
            workStart: '08:00',
            includeWeekends: false,
            workEnd: '18:00',
            calculateUsingDueDate: true,
        });

        kase.sla_due_date = existingDueDate;
        await caseRepository.update(kase);

        const updateSLATimers = new UpdateSLATimers(kase, shiftManagement, caseAns, stateAns, globalConfig);
        updateSLATimers.execute(currentTime);

        expect(kase.expired_at.value).toBe(existingDueDate);
        expect(kase.sla_due_date.value).toBe(existingDueDate);

        expect(kase.sla_remaining_minutes.value).toBe(5);
        expect(kase.sla_remaining_hours.value).toBe(0);
        expect(kase.sla_remaining_days.value).toBe(0);
    });
});
