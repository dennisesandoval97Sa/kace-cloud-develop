import { AggregateRoot, ValueObjectDescription, ValueObjectInt, ValueObjectTimestamp } from '../../shared';
import { ValueObjectHolidayDates, ValueObjectWorkDays } from '../../shift-management/index.js';
import { ValueObjectAnsPosicion } from './ValueObjectAnsPosicion';
import { ValueObjectAntiguedad } from './ValueObjectAntiguedad';
import { ValueObjectAntiguedadDias } from './ValueObjectAntiguedadDias';
import { ValueObjectAntiguedadHoras } from './ValueObjectAntiguedadHoras';
import { ValueObjectAntiguedadMinutos } from './ValueObjectAntiguedadMinutos';
import { ValueObjectTypes } from '../../ans/index.js';

export class CaseAns extends AggregateRoot {
    /** @type {ValueObjectHolidayDates} is initialized in the constructor */
    #holiday_dates;
    /** @type {ValueObjectWorkDays} is initialized in the constructor */
    #work_days;
    /** @type {ValueObjectTypes} is initialized in the constructor */
    #medicion_ans_id;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #intermedio;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #vencido;
    /** @type {ValueObjectAntiguedad} is initialized in the constructor */
    #antiguedad = null;
    /** @type {ValueObjectAnsPosicion} is initialized in the constructor */
    #ans_posicion = null;
    /** @type {ValueObjectAntiguedadDias} is initialized in the constructor */
    #antiguedad_dias = null;
    /** @type {ValueObjectAntiguedadHoras} is initialized in the constructor */
    #antiguedad_horas = null;
    /** @type {ValueObjectAntiguedadMinutos} is initialized in the constructor */
    #antiguedad_minutos = null;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #expired_at = null;
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #remaining_time = null;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #fecha_resolucion;
    /** @type {ValueObjectTimestamp} is initialized in the constructor*/
    #state_change_at;
    /** @type {ValueObjectAntiguedadDias} is initialized in the constructor*/
    #state_elapsed_days;
    /** @type {ValueObjectAntiguedadHoras} is initialized in the constructor*/
    #state_elapsed_hours;
    /** @type {ValueObjectAntiguedadMinutos} is initialized in the constructor*/
    #state_elapsed_minutes;
    /** @type {ValueObjectAntiguedad} is initialized in the constructor*/
    #state_elapsed_time;

    /** @type {ValueObjectAntiguedad} is initialized in the constructor */
    #sla_state_elapsed_time;
    /** @type {ValueObjectAntiguedadDias} is initialized in the constructor*/
    #sla_state_elapsed_days;
    /** @type {ValueObjectAntiguedadHoras} is initialized in the constructor*/
    #sla_state_elapsed_hours;
    /** @type {ValueObjectAntiguedadMinutos} is initialized in the constructor*/
    #sla_state_elapsed_minutes;
    /** @type {ValueObjectAnsPosicion} is initialized in the constructor */
    #sla_state_position;

    /** @type {ValueObjectAntiguedad} is initialized in the constructor */
    #sla_elapsed_time;
    /** @type {ValueObjectAntiguedadDias} is initialized in the constructor*/
    #sla_elapsed_days;
    /** @type {ValueObjectAntiguedadHoras} is initialized in the constructor*/
    #sla_elapsed_hours;
    /** @type {ValueObjectAntiguedadMinutos} is initialized in the constructor*/
    #sla_elapsed_minutes;
    /** @type {ValueObjectAnsPosicion} is initialized in the constructor */
    #sla_position;

    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #sla_due_date = null;
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #sla_remaining_time = null;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #sla_state_due_date = null;
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #sla_state_remaining_time = null;

    /** @type {ValueObjectTypes} is initialized in the constructor */
    #transitions_ans_medicion;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #transitions_ans_intermedio;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #transitions_ans_vencido;

    /** @type {ValueObjectAntiguedadDias} is initialized in the constructor*/
    #sla_remaining_days;
    /** @type {ValueObjectAntiguedadHoras} is initialized in the constructor*/
    #sla_remaining_hours;
    /** @type {ValueObjectAntiguedadMinutos} is initialized in the constructor*/
    #sla_remaining_minutes;
    /** @type {ValueObjectAntiguedadDias} is initialized in the constructor*/
    #sla_state_remaining_days;
    /** @type {ValueObjectAntiguedadHoras} is initialized in the constructor*/
    #sla_state_remaining_hours;
    /** @type {ValueObjectAntiguedadMinutos} is initialized in the constructor*/
    #sla_state_remaining_minutes;

    /**
     * @param {Object} params
     * @param {number} params.id - ID del caso.
     * @param {string} params.created_at - Fecha de creación del caso.
     * @param {string} params.medicion_ans_id - ID del tipo de medición ANS.
     * @param {number} params.intermedio - Umbral intermedio.
     * @param {number} params.vencido - Umbral de vencimiento.
     * @param {Object} params.work_days - Datos sobre los días laborables.
     * @param {Object} params.holiday_dates - Datos sobre las fechas festivas.
     * @param {string} params.fecha_resolucion - Fecha de resolución del caso.
     */
    constructor({
        id,
        created_at,
        medicion_ans_id,
        intermedio,
        vencido,
        work_days,
        holiday_dates,
        fecha_resolucion,
        state_change_at,
        state_elapsed_days,
        state_elapsed_hours,
        state_elapsed_minutes,
        state_elapsed_time,
        sla_state_elapsed_time,
        sla_state_elapsed_days,
        sla_state_elapsed_hours,
        sla_state_elapsed_minutes,
        sla_elapsed_time,
        sla_elapsed_days,
        sla_elapsed_hours,
        sla_elapsed_minutes,
        transitions_ans_medicion,
        transitions_ans_intermedio,
        transitions_ans_vencido,
        sla_remaining_days,
        sla_remaining_hours,
        sla_remaining_minutes,
        sla_state_remaining_days,
        sla_state_remaining_hours,
        sla_state_remaining_minutes,
    }) {
        super(id);
        this.created_at = created_at;
        this.#medicion_ans_id = new ValueObjectTypes('medicion_ans_id', medicion_ans_id);
        this.#intermedio = new ValueObjectInt('intermedio', intermedio);
        this.#vencido = new ValueObjectInt('vencido', vencido);
        this.#work_days = new ValueObjectWorkDays('work_days', work_days);
        this.#holiday_dates = new ValueObjectHolidayDates('holiday_dates', holiday_dates);
        this.#fecha_resolucion = new ValueObjectTimestamp('fecha_resolucion', fecha_resolucion, true);
        this.#state_change_at = new ValueObjectTimestamp('State change at', state_change_at, true);
        this.#state_elapsed_days = new ValueObjectAntiguedadDias('State elapsed days', state_elapsed_days, true);
        this.#state_elapsed_hours = new ValueObjectAntiguedadHoras('State elapsed hours', state_elapsed_hours, true);
        this.#state_elapsed_minutes = new ValueObjectAntiguedadMinutos(
            'State elapsed minutes',
            state_elapsed_minutes,
            true
        );
        this.#state_elapsed_time = new ValueObjectAntiguedad('State elapsed time', state_elapsed_time, true);

        this.#sla_state_elapsed_days = new ValueObjectAntiguedadDias(
            'SLA state elapsed days',
            sla_state_elapsed_days,
            true
        );
        this.#sla_state_elapsed_hours = new ValueObjectAntiguedadHoras(
            'SLA state elapsed hours',
            sla_state_elapsed_hours,
            true
        );
        this.#sla_state_elapsed_minutes = new ValueObjectAntiguedadMinutos(
            'SLA state elapsed minutes',
            sla_state_elapsed_minutes,
            true
        );
        this.#sla_state_elapsed_time = new ValueObjectAntiguedad(
            'SLA state elapsed time',
            sla_state_elapsed_time,
            true
        );

        this.#sla_elapsed_days = new ValueObjectAntiguedadDias('SLA elapsed days', sla_elapsed_days, true);
        this.#sla_elapsed_hours = new ValueObjectAntiguedadHoras('SLA elapsed hours', sla_elapsed_hours, true);
        this.#sla_elapsed_minutes = new ValueObjectAntiguedadMinutos('SLA elapsed minutes', sla_elapsed_minutes, true);
        this.#sla_elapsed_time = new ValueObjectAntiguedad('SLA elapsed time', sla_elapsed_time, true);

        this.#transitions_ans_medicion = new ValueObjectTypes(
            'transitions_ans_medicion',
            transitions_ans_medicion ?? medicion_ans_id
        );
        this.#transitions_ans_intermedio = new ValueObjectInt(
            'transitions_ans_intermedio',
            transitions_ans_intermedio ?? intermedio
        );
        this.#transitions_ans_vencido = new ValueObjectInt(
            'transitions_ans_vencido',
            transitions_ans_vencido ?? vencido
        );

        this.#sla_remaining_days = new ValueObjectAntiguedadDias('SLA remaining days', sla_remaining_days, true);
        this.#sla_remaining_hours = new ValueObjectAntiguedadHoras('SLA remaining hours', sla_remaining_hours, true);
        this.#sla_remaining_minutes = new ValueObjectAntiguedadMinutos(
            'SLA remaining minutes',
            sla_remaining_minutes,
            true
        );
        this.#sla_state_remaining_days = new ValueObjectAntiguedadDias(
            'SLA state remaining days',
            sla_state_remaining_days,
            true
        );
        this.#sla_state_remaining_hours = new ValueObjectAntiguedadHoras(
            'SLA state remaining hours',
            sla_state_remaining_hours,
            true
        );
        this.#sla_state_remaining_minutes = new ValueObjectAntiguedadMinutos(
            'SLA state remaining minutes',
            sla_state_remaining_minutes,
            true
        );
    }

    get antiguedad() {
        return this.#antiguedad;
    }

    set antiguedad(value) {
        if (this.#antiguedad?.value !== value) {
            this.#antiguedad = new ValueObjectAntiguedad('antiguedad', value);
            this.changedAttributes.antiguedad = value;
        }
    }

    get ans_posicion() {
        return this.#ans_posicion;
    }

    set ans_posicion(value) {
        if (this.#ans_posicion?.value !== value) {
            this.#ans_posicion = new ValueObjectAnsPosicion('ans_posicion', value);
            this.changedAttributes.ans_posicion = value;
        }
    }

    get sla_state_position() {
        return this.#sla_state_position;
    }

    set sla_state_position(value) {
        if (this.#sla_state_position?.value !== value) {
            this.#sla_state_position = new ValueObjectAnsPosicion('sla_state_position', value);
            this.changedAttributes.sla_state_position = value;
        }
    }

    get sla_position() {
        return this.#sla_position;
    }

    set sla_position(value) {
        if (this.#sla_position?.value !== value) {
            this.#sla_position = new ValueObjectAnsPosicion('sla_position', value);
            this.changedAttributes.sla_position = value;
        }
    }

    get antiguedad_dias() {
        return this.#antiguedad_dias;
    }

    set antiguedad_dias(value) {
        if (this.#antiguedad_dias?.value !== value) {
            this.#antiguedad_dias = new ValueObjectAntiguedadDias('antiguedad_dias', value);
            this.changedAttributes.antiguedad_dias = value;
        }
    }

    get antiguedad_horas() {
        return this.#antiguedad_horas;
    }

    set antiguedad_horas(value) {
        if (this.#antiguedad_horas?.value !== value) {
            this.#antiguedad_horas = new ValueObjectAntiguedadHoras('antiguedad_horas', value);
            this.changedAttributes.antiguedad_horas = value;
        }
    }

    get antiguedad_minutos() {
        return this.#antiguedad_minutos;
    }

    set antiguedad_minutos(value) {
        if (this.#antiguedad_minutos?.value !== value) {
            this.#antiguedad_minutos = new ValueObjectAntiguedadMinutos('antiguedad_minutos', value);
            this.changedAttributes.antiguedad_minutos = value;
        }
    }

    get expired_at() {
        return this.#expired_at;
    }

    set expired_at(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#expired_at?.value !== value) {
            this.#expired_at = new ValueObjectTimestamp('expired_at', value);
            this.changedAttributes.expired_at = value;
        }
    }

    get remaining_time() {
        return this.#remaining_time;
    }

    set remaining_time(value) {
        if (this.#remaining_time?.value !== value) {
            this.#remaining_time = new ValueObjectDescription('remaining_time', value);
            this.changedAttributes.remaining_time = value;
        }
    }

    get sla_due_date() {
        return this.#sla_due_date;
    }

    set sla_due_date(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#sla_due_date?.value !== value) {
            this.#sla_due_date = new ValueObjectTimestamp('sla_due_date', value);
            this.changedAttributes.sla_due_date = value;
        }
    }

    get sla_remaining_time() {
        return this.#sla_remaining_time;
    }

    set sla_remaining_time(value) {
        if (this.#sla_remaining_time?.value !== value) {
            this.#sla_remaining_time = new ValueObjectDescription('sla_remaining_time', value);
            this.changedAttributes.sla_remaining_time = value;
        }
    }

    get sla_state_due_date() {
        return this.#sla_state_due_date;
    }

    set sla_state_due_date(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#sla_state_due_date?.value !== value) {
            this.#sla_state_due_date = new ValueObjectTimestamp('sla_state_due_date', value);
            this.changedAttributes.sla_state_due_date = value;
        }
    }

    get sla_state_remaining_time() {
        return this.#sla_state_remaining_time;
    }

    set sla_state_remaining_time(value) {
        if (this.#sla_state_remaining_time?.value !== value) {
            this.#sla_state_remaining_time = new ValueObjectDescription('sla_state_remaining_time', value);
            this.changedAttributes.sla_state_remaining_time = value;
        }
    }

    get fecha_resolucion() {
        return this.#fecha_resolucion;
    }

    /**
     * @typedef {Object} ANSObject
     * @property {ValueObjectTypes} medicion_ans_id - El ID del tipo de medición ANS.
     * @property {ValueObjectInt} intermedio - El umbral intermedio en el ANS.
     * @property {ValueObjectInt} vencido - El umbral de vencimiento en el ANS.
     *
     * Get the ANS object.
     * @returns {ANSObject}
     */
    get ans() {
        return {
            medicion_ans_id: this.#medicion_ans_id,
            intermedio: this.#intermedio,
            vencido: this.#vencido,
        };
    }

    get transitionsAns() {
        return {
            medicion_ans_id: this.#transitions_ans_medicion,
            intermedio: this.#transitions_ans_intermedio,
            vencido: this.#transitions_ans_vencido,
        };
    }

    /**
     * @typedef {Object} ShiftObject
     * @property {ValueObjectHolidayDates} holiday_dates - Las fechas festivas asociadas al caso.
     * @property {ValueObjectWorkDays} work_days - Los días laborables asociados al caso.
     *
     * Get the Shift object.
     * @returns {ShiftObject}
     */
    get shift() {
        return {
            holiday_dates: this.#holiday_dates,
            work_days: this.#work_days,
        };
    }

    get state_change_at() {
        const lastChangeStateAt = this.#state_change_at.value ? this.#state_change_at : this.created_at;
        return lastChangeStateAt;
    }

    set state_change_at(value) {
        this.#state_change_at = new ValueObjectTimestamp('State change at', value);
    }

    get state_elapsed_days() {
        return this.#state_elapsed_days;
    }

    set state_elapsed_days(value) {
        this.#state_elapsed_days = new ValueObjectAntiguedadDias('State elapsed days', value);
        this.changedAttributes.state_elapsed_days = value;
    }

    get state_elapsed_hours() {
        return this.#state_elapsed_hours;
    }

    set state_elapsed_hours(value) {
        this.#state_elapsed_hours = new ValueObjectAntiguedadHoras('State elapsed hours', value);
        this.changedAttributes.state_elapsed_hours = value;
    }

    get state_elapsed_minutes() {
        return this.#state_elapsed_minutes;
    }

    set state_elapsed_minutes(value) {
        this.#state_elapsed_minutes = new ValueObjectAntiguedadMinutos('State elapsed minutes', value);
        this.changedAttributes.state_elapsed_minutes = value;
    }

    get state_elapsed_time() {
        return this.#state_elapsed_time;
    }

    set state_elapsed_time(value) {
        this.#state_elapsed_time = new ValueObjectAntiguedad('State elapsed time', value);
        this.changedAttributes.state_elapsed_time = value;
    }

    get sla_state_elapsed_days() {
        return this.#sla_state_elapsed_days;
    }

    set sla_state_elapsed_days(value) {
        this.#sla_state_elapsed_days = new ValueObjectAntiguedadDias('SLA state elapsed days', value);
        this.changedAttributes.sla_state_elapsed_days = value;
    }

    get sla_state_elapsed_hours() {
        return this.#sla_state_elapsed_hours;
    }

    set sla_state_elapsed_hours(value) {
        this.#sla_state_elapsed_hours = new ValueObjectAntiguedadHoras('SLA state elapsed hours', value);
        this.changedAttributes.sla_state_elapsed_hours = value;
    }

    get sla_state_elapsed_minutes() {
        return this.#sla_state_elapsed_minutes;
    }

    set sla_state_elapsed_minutes(value) {
        this.#sla_state_elapsed_minutes = new ValueObjectAntiguedadMinutos('SLA state elapsed minutes', value);
        this.changedAttributes.sla_state_elapsed_minutes = value;
    }

    get sla_state_elapsed_time() {
        return this.#sla_state_elapsed_time;
    }

    set sla_state_elapsed_time(value) {
        if (this.#sla_state_elapsed_time?.value !== value) {
            this.#sla_state_elapsed_time = new ValueObjectAntiguedad('SLA state elapsed time', value);
            this.changedAttributes.sla_state_elapsed_time = value;
        }
    }

    get sla_elapsed_days() {
        return this.#sla_elapsed_days;
    }

    set sla_elapsed_days(value) {
        this.#sla_elapsed_days = new ValueObjectAntiguedadDias('SLA elapsed days', value);
        this.changedAttributes.sla_elapsed_days = value;
    }

    get sla_elapsed_hours() {
        return this.#sla_elapsed_hours;
    }

    set sla_elapsed_hours(value) {
        this.#sla_elapsed_hours = new ValueObjectAntiguedadHoras('SLA elapsed hours', value);
        this.changedAttributes.sla_elapsed_hours = value;
    }

    get sla_elapsed_minutes() {
        return this.#sla_elapsed_minutes;
    }

    set sla_elapsed_minutes(value) {
        this.#sla_elapsed_minutes = new ValueObjectAntiguedadMinutos('SLA elapsed minutes', value);
        this.changedAttributes.sla_elapsed_minutes = value;
    }

    get sla_elapsed_time() {
        return this.#sla_elapsed_time;
    }

    set sla_elapsed_time(value) {
        if (this.#sla_elapsed_time?.value !== value) {
            this.#sla_elapsed_time = new ValueObjectAntiguedad('SLA elapsed time', value);
            this.changedAttributes.sla_elapsed_time = value;
        }
    }

    get sla_remaining_days() {
        return this.#sla_remaining_days;
    }

    set sla_remaining_days(value) {
        this.#sla_remaining_days = new ValueObjectAntiguedadDias('SLA remaining days', value);
        this.changedAttributes.sla_remaining_days = value;
    }

    get sla_remaining_hours() {
        return this.#sla_remaining_hours;
    }

    set sla_remaining_hours(value) {
        this.#sla_remaining_hours = new ValueObjectAntiguedadHoras('SLA remaining hours', value);
        this.changedAttributes.sla_remaining_hours = value;
    }

    get sla_remaining_minutes() {
        return this.#sla_remaining_minutes;
    }

    set sla_remaining_minutes(value) {
        this.#sla_remaining_minutes = new ValueObjectAntiguedadMinutos('SLA remaining minutes', value);
        this.changedAttributes.sla_remaining_minutes = value;
    }

    get sla_state_remaining_days() {
        return this.#sla_state_remaining_days;
    }

    set sla_state_remaining_days(value) {
        this.#sla_state_remaining_days = new ValueObjectAntiguedadDias('SLA state remaining days', value);
        this.changedAttributes.sla_state_remaining_days = value;
    }

    get sla_state_remaining_hours() {
        return this.#sla_state_remaining_hours;
    }

    set sla_state_remaining_hours(value) {
        this.#sla_state_remaining_hours = new ValueObjectAntiguedadHoras('SLA state remaining hours', value);
        this.changedAttributes.sla_state_remaining_hours = value;
    }

    get sla_state_remaining_minutes() {
        return this.#sla_state_remaining_minutes;
    }

    set sla_state_remaining_minutes(value) {
        this.#sla_state_remaining_minutes = new ValueObjectAntiguedadMinutos('SLA state remaining minutes', value);
        this.changedAttributes.sla_state_remaining_minutes = value;
    }

    /**
     * Create an CaseAns instance from a database row.
     * @param {Object} dto - The data transfer object containing the properties for the CaseAns object.
     * @param {Case} kace
     * @param {Ans} ans
     * @param {ShiftManagement} shiftManagement
     * @returns {CaseAns}
     */
    static create(dto, kace, ans, shiftManagement) {
        if (typeof dto === 'object') {
            return new CaseAns(dto);
        } else {
            return new CaseAns({
                id: kace.id.value,
                medicion_ans_id: ans.medicion_ans_id.value,
                intermedio: ans.intermedio.value,
                vencido: ans.vencido.value,
                work_days: shiftManagement.work_days.value,
                holiday_dates: shiftManagement.holiday_dates.value,
                created_at: kace.created_at.value,
            });
        }
    }

    /**
     *
     * @returns {boolean}
     */
    isResolved() {
        return this.fecha_resolucion.value !== null;
    }

    /**
     *
     * @returns {{created_at: string, medicion_ans_id: *, intermedio, vencido, work_days, holiday_dates, fecha_resolucion: string}}
     */
    toJson() {
        return {
            created_at: this.created_at.value,
            medicion_ans_id: this.#medicion_ans_id.value,
            intermedio: this.#intermedio.value,
            vencido: this.#vencido.value,
            work_days: this.#work_days.value,
            holiday_dates: this.#holiday_dates.value,
            fecha_resolucion: this.#fecha_resolucion.value,
            state_change_at: this.#state_change_at.value,
            state_elapsed_days: this.#state_elapsed_days.value,
            state_elapsed_hours: this.#state_elapsed_hours.value,
            state_elapsed_minutes: this.#state_elapsed_minutes.value,
            state_elapsed_time: this.#state_elapsed_time.value,

            sla_state_elapsed_days: this.#sla_state_elapsed_days.value,
            sla_state_elapsed_hours: this.#sla_state_elapsed_hours.value,
            sla_state_elapsed_minutes: this.#sla_state_elapsed_minutes.value,
            sla_state_elapsed_time: this.#sla_state_elapsed_time.value,

            sla_elapsed_days: this.#sla_elapsed_days.value,
            sla_elapsed_hours: this.#sla_elapsed_hours.value,
            sla_elapsed_minutes: this.#sla_elapsed_minutes.value,
            sla_elapsed_time: this.#sla_elapsed_time.value,

            transitions_ans_medicion: this.#transitions_ans_medicion.value,
            transitions_ans_intermedio: this.#transitions_ans_intermedio.value,
            transitions_ans_vencido: this.#transitions_ans_vencido.value,

            sla_remaining_days: this.#sla_remaining_days.value,
            sla_remaining_hours: this.#sla_remaining_hours.value,
            sla_remaining_minutes: this.#sla_remaining_minutes.value,

            sla_state_remaining_days: this.#sla_state_remaining_days.value,
            sla_state_remaining_hours: this.#sla_state_remaining_hours.value,
            sla_state_remaining_minutes: this.#sla_state_remaining_minutes.value,
        };
    }
}
