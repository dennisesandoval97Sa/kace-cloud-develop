import { AnsCalculator } from './AnsCalculator';
import { ExpirationCalculator } from './ExpirationCalculator';
import { remainingTimeCalculator } from './RemainingTimeCalculator.js';
import dayjs from 'dayjs';
import { ShiftManagement } from '../../../shift-management/index.js';
import { Helper } from '../../infrastructure/utils/Helper.js';

export class UpdateSLATimers {
    /** @type {Case} is initialized in the constructor*/
    #kase;

    /** @type {ShiftManagement} is initialized in the constructor*/
    #shiftManagement;

    /** @type {Ans} is initialized in the constructor*/
    #caseAns;

    /** @type {Ans} is initialized in the constructor*/
    #stateAns;

    /** @type {Object} is initialized in the constructor*/
    #settings;

    /**
     *
     * @param {Case} kase
     * @param {ShiftManagement} shiftManagement
     * @param {Ans} caseAns
     * @param {Ans|null} stateAns
     */
    constructor(kase, shiftManagement, caseAns, stateAns, settings) {
        this.#kase = kase;
        this.#shiftManagement = shiftManagement;
        this.#caseAns = caseAns;
        this.#stateAns = stateAns || caseAns;
        this.#settings = settings;
    }

    /**
     * Updates SLA timers for a case by calculating both case and state timers
     */
    execute(currentTime = dayjs()) {
        const caseId = this.#kase.id?.value || 'unknown';
        Helper.logTime(`UpdateSLA-Case-${caseId}`);
        this.calculateCase(currentTime);
        Helper.logTimeEnd(`UpdateSLA-Case-${caseId}`);

        Helper.logTime(`UpdateSLA-State-${caseId}`);
        this.calculateState(currentTime);
        Helper.logTimeEnd(`UpdateSLA-State-${caseId}`);

        return this.#kase;
    }

    /**
     *
     * @param {CaseAns} caseData
     * @param currentTime
     */
    calculateState(currentTime) {
        const referenceTransitionDate = this.#kase.state_change_at.value;
        const stateCalculatorItems = {
            ans: this.#stateAns,
            shift: this.#shiftManagement,
        };
        const stateAntiquity = new AnsCalculator(stateCalculatorItems, currentTime, referenceTransitionDate);
        this.#kase.state_elapsed_time = stateAntiquity.description;
        this.#kase.state_elapsed_days = stateAntiquity.days;
        this.#kase.state_elapsed_hours = stateAntiquity.hours;
        this.#kase.state_elapsed_minutes = stateAntiquity.minutes;

        this.#kase.sla_state_elapsed_time = stateAntiquity.description;
        this.#kase.sla_state_elapsed_days = stateAntiquity.days;
        this.#kase.sla_state_elapsed_hours = stateAntiquity.hours;
        this.#kase.sla_state_elapsed_minutes = stateAntiquity.minutes;
        this.#kase.sla_state_position = stateAntiquity.position;

        const expirationState = new ExpirationCalculator(stateCalculatorItems, currentTime, referenceTransitionDate);
        this.#kase.sla_state_due_date = expirationState.expiredAt;

        const remainingTime = remainingTimeCalculator({
            currentDateTime: currentTime,
            dueDateTime: this.#kase.sla_state_due_date.value,
            shifts: this.#shiftManagement.work_days.value,
            workDays: this.#shiftManagement.workDaysAsNumbers(),
            holidays: this.#shiftManagement.holiday_dates.value,
        });
        this.#kase.sla_state_remaining_time = remainingTime.asText;
        this.#kase.sla_state_remaining_days = remainingTime.days;
        this.#kase.sla_state_remaining_hours = remainingTime.hours;
        this.#kase.sla_state_remaining_minutes = remainingTime.minutes;
    }

    /**
     *
     * @param currentTime
     */
    calculateCase(currentTime) {
        const referenceCaseDate = this.#kase.created_at.value;
        const caseCalculatorItems = {
            ans: this.#caseAns,
            shift: this.#shiftManagement,
        };
        const antiquity = new AnsCalculator(caseCalculatorItems, currentTime, referenceCaseDate);
        this.#kase.antiguedad = antiquity.description;
        this.#kase.ans_posicion = antiquity.position;
        this.#kase.antiguedad_dias = antiquity.days;
        this.#kase.antiguedad_horas = antiquity.hours;
        this.#kase.antiguedad_minutos = antiquity.minutes;

        this.#kase.sla_position = antiquity.position;
        this.#kase.sla_elapsed_time = antiquity.description;
        this.#kase.sla_elapsed_days = antiquity.days;
        this.#kase.sla_elapsed_hours = antiquity.hours;
        this.#kase.sla_elapsed_minutes = antiquity.minutes;

        const useDueDateForAnsCalculation =
            this.#settings?.behaviors?.application?.agente?.casos?.due_date_for_ans_calculation ?? false;

        const hasExistingDueDate = useDueDateForAnsCalculation && this.#kase.sla_due_date.value;

        if (hasExistingDueDate) {
            this.#kase.expired_at = this.#kase.sla_due_date.value;
        } else {
            if (useDueDateForAnsCalculation) {
                Helper.logWarning(
                    `Case ${this.#kase.id?.value}: useDueDateForAnsCalculation is enabled but sla_due_date is null. Falling back to ExpirationCalculator.`
                );
            }
            const expiration = new ExpirationCalculator(caseCalculatorItems, currentTime, referenceCaseDate);
            this.#kase.expired_at = expiration.expiredAt;
            this.#kase.sla_due_date = expiration.expiredAt;
        }

        if (!this.#kase.sla_due_date.value) {
            Helper.logWarning(
                `Case ${this.#kase.id?.value}: sla_due_date is still null after calculation. Skipping remaining time.`
            );
            return;
        }

        const remainingTime = remainingTimeCalculator({
            currentDateTime: currentTime,
            dueDateTime: this.#kase.sla_due_date.value,
            shifts: this.#shiftManagement.work_days.value,
            workDays: this.#shiftManagement.workDaysAsNumbers(),
            holidays: this.#shiftManagement.holiday_dates.value,
        });
        this.#kase.remaining_time = remainingTime.asText;
        this.#kase.sla_remaining_time = remainingTime.asText;

        this.#kase.sla_remaining_days = remainingTime.days;
        this.#kase.sla_remaining_hours = remainingTime.hours;
        this.#kase.sla_remaining_minutes = remainingTime.minutes;
    }
}
