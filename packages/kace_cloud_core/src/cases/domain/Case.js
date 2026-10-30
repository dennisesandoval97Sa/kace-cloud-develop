import {
    ValueObjectAltoImpacto,
    ValueObjectAnsPosicion,
    ValueObjectAntiguedad,
    ValueObjectAntiguedadDias,
    ValueObjectAntiguedadHoras,
    ValueObjectAntiguedadMinutos,
    ValueObjectCambioClasificacion,
    ValueObjectMotivoBaja,
    ValueObjectVista,
} from '../index.js';
import {
    AggregateRoot,
    ValueObjectInt,
    ValueObjectTimestamp,
    ValueObjectUuid,
    ValueObjectString,
    ValueObjectBoolean,
} from '../../shared/index.js';
import { ValueObjectCanalId } from './ValueObjectCanalId.js';
import { ValueObjectUpdateSource } from './ValueObjectUpdateSource.js';
import { ValueObjectAssignmentChangeType } from './ValueObjectAssignmentChangeType.js';

export class Case extends AggregateRoot {
    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #cliente_id;
    get cliente_id() {
        return this.#cliente_id;
    }

    set cliente_id(value) {
        this.#cliente_id = new ValueObjectUuid('Cliente id', value);
        this.changedAttributes.cliente_id = value;
    }

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #transicion_id;
    get transicion_id() {
        return this.#transicion_id;
    }

    set transicion_id(value) {
        if (this.#transicion_id?.value === value) {
            return;
        }
        this.#transicion_id = new ValueObjectUuid('Transición id', value);
        this.changedAttributes.transicion_id = value;
    }

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #estado_id;
    get estado_id() {
        return this.#estado_id;
    }

    set estado_id(value) {
        if (this.#estado_id?.value === value) {
            return;
        }
        this.#estado_id = new ValueObjectUuid('Estado id', value, true);
        this.changedAttributes.estado_id = value;
    }

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #responsable_id;
    get responsable_id() {
        return this.#responsable_id;
    }

    set responsable_id(value) {
        const previousResponsableId = this.#responsable_id?.value ?? null;
        if (previousResponsableId === value) {
            return;
        }
        this.#responsable_id = new ValueObjectUuid('Responsable id', value);
        this.changedAttributes.responsable_id = value;

        if (value != null) {
            this.last_assigned_at = new Date();
        }

        if (
            previousResponsableId !== null &&
            this.#first_view_at?.value !== null &&
            this.#first_view_at?.value !== undefined
        ) {
            this.first_view_at = null;
        }
    }

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #clasificacion_id;
    get clasificacion_id() {
        return this.#clasificacion_id;
    }

    set clasificacion_id(value) {
        this.#clasificacion_id = new ValueObjectUuid('Clasificación id', value);
        this.changedAttributes.clasificacion_id = value;
    }

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #descripcion_caso_id;
    get descripcion_caso_id() {
        return this.#descripcion_caso_id;
    }

    set descripcion_caso_id(value) {
        this.#descripcion_caso_id = new ValueObjectUuid('Descripción caso id', value);
        this.changedAttributes.descripcion_caso_id = value;
    }
    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #caso_clonado_id;
    get caso_clonado_id() {
        return this.#caso_clonado_id;
    }

    set caso_clonado_id(value) {
        this.#caso_clonado_id = new ValueObjectUuid('Caso clonado id', value);
        this.changedAttributes.caso_clonado_id = value;
    }

    /**
     * @type {ValueObjectCanalId}
     * is initialized in the constructor
     */
    #canal_id;
    get canal_id() {
        return this.#canal_id;
    }

    set canal_id(value) {
        this.#canal_id = new ValueObjectCanalId('Canal id', value);
        this.changedAttributes.canal_id = value;
    }

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #grupo_id;
    get grupo_id() {
        return this.#grupo_id;
    }

    set grupo_id(value) {
        this.#grupo_id = new ValueObjectUuid('Grupo id', value);
        this.changedAttributes.grupo_id = value;
    }

    /**
     * @type {ValueObjectTimestamp}
     * is initialized in the constructor
     */
    #fecha_resolucion;
    get fecha_resolucion() {
        return this.#fecha_resolucion;
    }

    set fecha_resolucion(value) {
        this.#fecha_resolucion = new ValueObjectTimestamp('Fecha resolución', value, true);
        this.changedAttributes.fecha_resolucion = value;
    }

    /**
     * @type {ValueObjectAntiguedad}
     * is initialized in the constructor
     */
    #antiguedad;
    get antiguedad() {
        return this.#antiguedad;
    }

    set antiguedad(value) {
        this.#antiguedad = new ValueObjectAntiguedad('Antiguedad', value);
        this.changedAttributes.antiguedad = value;
    }

    /**
     * @type {ValueObjectAnsPosicion}
     * is initialized in the constructor
     */
    #ans_posicion;
    get ans_posicion() {
        return this.#ans_posicion;
    }

    set ans_posicion(value) {
        this.#ans_posicion = new ValueObjectAnsPosicion('Ans posición', value);
        this.changedAttributes.ans_posicion = value;
    }

    /**
     * @type {ValueObjectAntiguedadDias}
     * is initialized in the constructor
     */
    #antiguedad_dias;
    get antiguedad_dias() {
        return this.#antiguedad_dias;
    }

    set antiguedad_dias(value) {
        this.#antiguedad_dias = new ValueObjectAntiguedadDias('Antiguedad días', value);
        this.changedAttributes.antiguedad_dias = value;
    }

    /**
     * @type {ValueObjectAntiguedadHoras}
     * is initialized in the constructor
     */
    #antiguedad_horas;
    get antiguedad_horas() {
        return this.#antiguedad_horas;
    }

    set antiguedad_horas(value) {
        this.#antiguedad_horas = new ValueObjectAntiguedadHoras('Antiguedad horas', value);
        this.changedAttributes.antiguedad_horas = value;
    }

    /**
     * @type {ValueObjectAntiguedadMinutos}
     * is initialized in the constructor
     */
    #antiguedad_minutos;
    get antiguedad_minutos() {
        return this.#antiguedad_minutos;
    }

    set antiguedad_minutos(value) {
        this.#antiguedad_minutos = new ValueObjectAntiguedadMinutos('Antiguedad minutos', value);
        this.changedAttributes.antiguedad_minutos = value;
    }

    /**
     * @type {ValueObjectMotivoBaja}
     * is initialized in the constructor
     */
    #motivo_baja;
    get motivo_baja() {
        return this.#motivo_baja;
    }

    set motivo_baja(value) {
        this.#motivo_baja = new ValueObjectMotivoBaja('Motivo baja', value, true);
        this.changedAttributes.motivo_baja = value;
    }

    /**
     * @type {ValueObjectAltoImpacto}
     * is initialized in the constructor
     */
    #alto_impacto;
    get alto_impacto() {
        return this.#alto_impacto;
    }

    set alto_impacto(value) {
        this.#alto_impacto = new ValueObjectAltoImpacto('Alto impacto', value);
        this.changedAttributes.alto_impacto = value;
    }

    /**
     * @type {ValueObjectVista}
     * is initialized in the constructor
     */
    #vista;
    get vista() {
        return this.#vista;
    }

    set vista(value) {
        this.#vista = new ValueObjectVista('Vista', value);
        this.changedAttributes.vista = value;
    }

    /** @type {ValueObjectTimestamp} is initialized in the constructor*/
    #expired_at;
    get expired_at() {
        return this.#expired_at;
    }

    set expired_at(value) {
        if (this.#expired_at.value !== value) {
            this.#expired_at = new ValueObjectTimestamp('expired_at', value, true);
            this.changedAttributes.expired_at = value;
        }
    }

    /** @type{ValueObjectString} is initialized in the constructor*/
    #remaining_time;
    get remaining_time() {
        return this.#remaining_time;
    }

    set remaining_time(value) {
        if (this.#remaining_time.value !== value) {
            this.#remaining_time = new ValueObjectString('remaining_time', value, true);
            this.changedAttributes.remaining_time = value;
        }
    }

    /**
     * @type {ValueObjectCambioClasificacion}
     * is initialized in the constructor
     */
    #cambio_clasificacion;
    get cambio_clasificacion() {
        return this.#cambio_clasificacion;
    }

    set cambio_clasificacion(value) {
        this.#cambio_clasificacion = new ValueObjectCambioClasificacion('Cambio clasificación', value);
        this.changedAttributes.cambio_clasificacion = value;
    }

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #cambio_estado_comentario_id;
    get cambio_estado_comentario_id() {
        return this.#cambio_estado_comentario_id;
    }

    set cambio_estado_comentario_id(value) {
        this.#cambio_estado_comentario_id = new ValueObjectUuid('Cambio estado comentario id', value);
        this.changedAttributes.cambio_estado_comentario_id = value;
    }

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #cloned_by;
    get cloned_by() {
        return this.#cloned_by;
    }

    set cloned_by(value) {
        this.#cloned_by = new ValueObjectUuid('Cloned by', value);
        this.changedAttributes.cloned_by = value;
    }

    /**
     * @type {ValueObjectTimestamp}
     * is initialized in the constructor
     */
    #cloned_at;
    get cloned_at() {
        return this.#cloned_at;
    }

    set cloned_at(value) {
        this.#cloned_at = new ValueObjectTimestamp('Cloned at', value);
        this.changedAttributes.cloned_at = value;
    }

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #reopen_by;
    get reopen_by() {
        return this.#reopen_by;
    }

    set reopen_by(value) {
        this.#reopen_by = new ValueObjectUuid('Reopen by', value);
        this.changedAttributes.reopen_by = value;
    }

    /**
     * @type {ValueObjectTimestamp}
     * is initialized in the constructor
     */
    #reopen_at;
    get reopen_at() {
        return this.#reopen_at;
    }

    set reopen_at(value) {
        this.#reopen_at = new ValueObjectTimestamp('Reopen at', value);
        this.changedAttributes.reopen_at = value;
    }

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #asignacion_agente = null;
    get asignacion_agente() {
        return this.#asignacion_agente;
    }

    set asignacion_agente(value) {
        this.#asignacion_agente = new ValueObjectUuid('asignacion_agente', value);
    }

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #asignacion_grupo = null;
    get asignacion_grupo() {
        return this.#asignacion_grupo;
    }

    set asignacion_grupo(value) {
        this.#asignacion_grupo = new ValueObjectUuid('asignacion_grupo', value);
    }

    /**
     * @type {ValueObjectUuid}
     *  is initialized in the constructor
     */
    #closed_by;
    get closed_by() {
        return this.#closed_by;
    }

    set closed_by(value) {
        this.#closed_by = new ValueObjectUuid('closed by', value);
        this.changedAttributes.closed_by = value;
    }

    /**
     * @type {ValueObjectTimestamp}
     * is initialized in the constructor
     */
    #closed_at;
    get closed_at() {
        return this.#closed_at;
    }

    set closed_at(value) {
        this.#closed_at = new ValueObjectTimestamp('closed at', value);
        this.changedAttributes.closed_at = value;
    }

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #edited_by;
    get edited_by() {
        return this.#edited_by;
    }

    set edited_by(value) {
        this.#edited_by = new ValueObjectUuid('edited by', value, true);
        this.changedAttributes.edited_by = value;
    }

    /**
     * @type {ValueObjectTimestamp}
     * is initialized in the constructor
     */
    #edited_at;
    get edited_at() {
        return this.#edited_at;
    }

    set edited_at(value) {
        this.#edited_at = new ValueObjectTimestamp('edited at', value, true);
        this.changedAttributes.edited_at = value;
    }

    /**
     * @type {ValueObjectInt}
     */
    #reference; // is initialized in the constructor
    get reference() {
        return this.#reference;
    }

    set reference(value) {
        this.#reference = new ValueObjectInt('Reference', value);
        this.changedAttributes.reference = value;
    }

    /**
     * @type {ValueObjectTimestamp}
     * is initialized in the constructor
     */
    #state_change_at;
    get state_change_at() {
        const lastChangeStateAt = this.#state_change_at.value ? this.#state_change_at : this.created_at;
        return lastChangeStateAt;
    }

    set state_change_at(value) {
        this.#state_change_at = new ValueObjectTimestamp('State change at', value);
        this.changedAttributes.state_change_at = value;
    }

    /**
     * @type {ValueObjectAntiguedadDias}
     * is initialized in the constructor
     */
    #state_elapsed_days;
    get state_elapsed_days() {
        return this.#state_elapsed_days;
    }

    set state_elapsed_days(value) {
        this.#state_elapsed_days = new ValueObjectAntiguedadDias('State elapsed days', value);
        this.changedAttributes.state_elapsed_days = value;
    }

    /**
     * @type {ValueObjectAntiguedadHoras}
     * is initialized in the constructor
     */
    #state_elapsed_hours;
    get state_elapsed_hours() {
        return this.#state_elapsed_hours;
    }

    set state_elapsed_hours(value) {
        this.#state_elapsed_hours = new ValueObjectAntiguedadHoras('State elapsed hours', value);
        this.changedAttributes.state_elapsed_hours = value;
    }

    /**
     * @type {ValueObjectAntiguedadMinutos}
     * is initialized in the constructor
     */
    #state_elapsed_minutes;
    get state_elapsed_minutes() {
        return this.#state_elapsed_minutes;
    }

    set state_elapsed_minutes(value) {
        this.#state_elapsed_minutes = new ValueObjectAntiguedadMinutos('State elapsed minutes', value);
        this.changedAttributes.state_elapsed_minutes = value;
    }

    /**
     * @type {ValueObjectAntiguedad}
     * is initialized in the constructor
     */
    #state_elapsed_time;
    get state_elapsed_time() {
        return this.#state_elapsed_time;
    }

    set state_elapsed_time(value) {
        this.#state_elapsed_time = new ValueObjectAntiguedad('State elapsed time', value);
        this.changedAttributes.state_elapsed_time = value;
    }

    /**
     * @type {ValueObjectString}
     * is initialized in the constructor
     */
    #external_code;
    get external_code() {
        return this.#external_code;
    }

    set external_code(value) {
        this.#external_code = new ValueObjectString('External code', value);
        this.changedAttributes.external_code = value;
    }

    /**
     * @type {ValueObjectString}
     * Configurable folio (radicado) generated from the classification's folio
     * configuration. Independent of `external_code` and its legacy folio.
     * is initialized in the constructor
     */
    #folio;
    get folio() {
        return this.#folio;
    }

    set folio(value) {
        this.#folio = new ValueObjectString('Folio', value, true);
        this.changedAttributes.folio = value;
    }

    /**
     * @type {ValueObjectUuid}
     *  is initialized in the constructor
     */
    #sla_id;
    get sla_id() {
        return this.#sla_id;
    }

    set sla_id(value) {
        this.#sla_id = new ValueObjectUuid('sla_id', value);
        this.changedAttributes.sla_id = value;
    }

    /**
     * @type {ValueObjectUuid}
     *  is initialized in the constructor
     */
    #sla_state_id;
    get sla_state_id() {
        return this.#sla_state_id;
    }

    set sla_state_id(value) {
        this.#sla_state_id = new ValueObjectUuid('sla_state_id', value);
        this.changedAttributes.sla_state_id = value;
    }

    /** @type {ValueObjectTimestamp} is initialized in the constructor*/
    #sla_due_date;
    get sla_due_date() {
        return this.#sla_due_date;
    }

    set sla_due_date(value) {
        if (this.#sla_due_date.value !== value) {
            this.#sla_due_date = new ValueObjectTimestamp('sla_due_date', value, true);
            this.changedAttributes.sla_due_date = value;
        }
    }

    /** @type {ValueObjectString} is initialized in the constructor*/
    #sla_elapsed_time;
    get sla_elapsed_time() {
        return this.#sla_elapsed_time;
    }

    set sla_elapsed_time(value) {
        if (this.#sla_elapsed_time.value !== value) {
            this.#sla_elapsed_time = new ValueObjectString('sla_elapsed_time', value, true);
            this.changedAttributes.sla_elapsed_time = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor*/
    #sla_elapsed_days;
    get sla_elapsed_days() {
        return this.#sla_elapsed_days;
    }

    set sla_elapsed_days(value) {
        if (this.#sla_elapsed_days.value !== value) {
            this.#sla_elapsed_days = new ValueObjectInt('sla_elapsed_days', value, true);
            this.changedAttributes.sla_elapsed_days = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor*/
    #sla_elapsed_hours;

    get sla_elapsed_hours() {
        return this.#sla_elapsed_hours;
    }

    set sla_elapsed_hours(value) {
        if (this.#sla_elapsed_hours.value !== value) {
            this.#sla_elapsed_hours = new ValueObjectInt('sla_elapsed_hours', value, true);
            this.changedAttributes.sla_elapsed_hours = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor*/
    #sla_elapsed_minutes;
    get sla_elapsed_minutes() {
        return this.#sla_elapsed_minutes;
    }

    set sla_elapsed_minutes(value) {
        if (this.#sla_elapsed_minutes.value !== value) {
            this.#sla_elapsed_minutes = new ValueObjectInt('sla_elapsed_minutes', value, true);
            this.changedAttributes.sla_elapsed_minutes = value;
        }
    }

    /** @type {ValueObjectString} is initialized in the constructor*/
    #sla_remaining_time;

    get sla_remaining_time() {
        return this.#sla_remaining_time;
    }

    set sla_remaining_time(value) {
        if (this.#sla_remaining_time.value !== value) {
            this.#sla_remaining_time = new ValueObjectString('sla_remaining_time', value, true);
            this.changedAttributes.sla_remaining_time = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor*/
    #sla_remaining_days;

    get sla_remaining_days() {
        return this.#sla_remaining_days;
    }

    set sla_remaining_days(value) {
        if (this.#sla_remaining_days.value !== value) {
            this.#sla_remaining_days = new ValueObjectInt('sla_remaining_days', value, true);
            this.changedAttributes.sla_remaining_days = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor*/
    #sla_remaining_hours;

    get sla_remaining_hours() {
        return this.#sla_remaining_hours;
    }

    set sla_remaining_hours(value) {
        if (this.#sla_remaining_hours.value !== value) {
            this.#sla_remaining_hours = new ValueObjectInt('sla_remaining_hours', value, true);
            this.changedAttributes.sla_remaining_hours = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor*/
    #sla_remaining_minutes;

    get sla_remaining_minutes() {
        return this.#sla_remaining_minutes;
    }

    set sla_remaining_minutes(value) {
        if (this.#sla_remaining_minutes.value !== value) {
            this.#sla_remaining_minutes = new ValueObjectInt('sla_remaining_minutes', value, true);
            this.changedAttributes.sla_remaining_minutes = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor*/
    #sla_position;
    get sla_position() {
        return this.#sla_position;
    }

    set sla_position(value) {
        if (this.#sla_position.value !== value) {
            this.#sla_position = new ValueObjectInt('sla_position', value, true);
            this.changedAttributes.sla_position = value;
        }
    }

    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #sla_state_due_date;
    get sla_state_due_date() {
        return this.#sla_state_due_date;
    }

    set sla_state_due_date(value) {
        if (this.#sla_state_due_date.value !== value) {
            this.#sla_state_due_date = new ValueObjectTimestamp('sla_state_due_date', value, true);
            this.changedAttributes.sla_state_due_date = value;
        }
    }

    /** @type {ValueObjectString} is initialized in the constructor */
    #sla_state_elapsed_time;
    get sla_state_elapsed_time() {
        return this.#sla_state_elapsed_time;
    }

    set sla_state_elapsed_time(value) {
        if (this.#sla_state_elapsed_time.value !== value) {
            this.#sla_state_elapsed_time = new ValueObjectString('sla_state_elapsed_time', value, true);
            this.changedAttributes.sla_state_elapsed_time = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor */
    #sla_state_elapsed_days;
    get sla_state_elapsed_days() {
        return this.#sla_state_elapsed_days;
    }

    set sla_state_elapsed_days(value) {
        if (this.#sla_state_elapsed_days.value !== value) {
            this.#sla_state_elapsed_days = new ValueObjectInt('sla_state_elapsed_days', value, true);
            this.changedAttributes.sla_state_elapsed_days = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor */
    #sla_state_elapsed_hours;
    get sla_state_elapsed_hours() {
        return this.#sla_state_elapsed_hours;
    }

    set sla_state_elapsed_hours(value) {
        if (this.#sla_state_elapsed_hours.value !== value) {
            this.#sla_state_elapsed_hours = new ValueObjectInt('sla_state_elapsed_hours', value, true);
            this.changedAttributes.sla_state_elapsed_hours = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor */
    #sla_state_elapsed_minutes;
    get sla_state_elapsed_minutes() {
        return this.#sla_state_elapsed_minutes;
    }

    set sla_state_elapsed_minutes(value) {
        if (this.#sla_state_elapsed_minutes.value !== value) {
            this.#sla_state_elapsed_minutes = new ValueObjectInt('sla_state_elapsed_minutes', value, true);
            this.changedAttributes.sla_state_elapsed_minutes = value;
        }
    }

    /** @type {ValueObjectString} is initialized in the constructor */
    #sla_state_remaining_time;
    get sla_state_remaining_time() {
        return this.#sla_state_remaining_time;
    }

    set sla_state_remaining_time(value) {
        if (this.#sla_state_remaining_time.value !== value) {
            this.#sla_state_remaining_time = new ValueObjectString('sla_state_remaining_time', value, true);
            this.changedAttributes.sla_state_remaining_time = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor */
    #sla_state_remaining_days;
    get sla_state_remaining_days() {
        return this.#sla_state_remaining_days;
    }

    set sla_state_remaining_days(value) {
        if (this.#sla_state_remaining_days.value !== value) {
            this.#sla_state_remaining_days = new ValueObjectInt('sla_state_remaining_days', value, true);
            this.changedAttributes.sla_state_remaining_days = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor */
    #sla_state_remaining_hours;
    get sla_state_remaining_hours() {
        return this.#sla_state_remaining_hours;
    }

    set sla_state_remaining_hours(value) {
        if (this.#sla_state_remaining_hours.value !== value) {
            this.#sla_state_remaining_hours = new ValueObjectInt('sla_state_remaining_hours', value, true);
            this.changedAttributes.sla_state_remaining_hours = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor */
    #sla_state_remaining_minutes;
    get sla_state_remaining_minutes() {
        return this.#sla_state_remaining_minutes;
    }

    set sla_state_remaining_minutes(value) {
        if (this.#sla_state_remaining_minutes.value !== value) {
            this.#sla_state_remaining_minutes = new ValueObjectInt('sla_state_remaining_minutes', value, true);
            this.changedAttributes.sla_state_remaining_minutes = value;
        }
    }

    /** @type {ValueObjectInt} is initialized in the constructor */
    #sla_state_position;

    get sla_state_position() {
        return this.#sla_state_position;
    }

    set sla_state_position(value) {
        if (this.#sla_state_position.value !== value) {
            this.#sla_state_position = new ValueObjectInt('sla_state_position', value, true);
            this.changedAttributes.sla_state_position = value;
        }
    }

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #parent_id;
    get parent_id() {
        return this.#parent_id;
    }

    set parent_id(value) {
        this.#parent_id = new ValueObjectUuid('parent_id', value);
        this.changedAttributes.parent_id = value;
    }

    /**
     * @type {ValueObjectBoolean}
     * is initialized in the constructor
     */
    #is_visible;
    get is_visible() {
        return this.#is_visible;
    }

    set is_visible(value) {
        this.#is_visible = new ValueObjectBoolean('is_visible', value);
        this.changedAttributes.is_visible = value;
    }

    /**
     * @type {ValueObjectTimestamp}
     * is initialized in the constructor
     */
    #last_assigned_at;
    get last_assigned_at() {
        return this.#last_assigned_at;
    }

    set last_assigned_at(value) {
        this.#last_assigned_at = new ValueObjectTimestamp('last_assigned_at', value, true);
        this.changedAttributes.last_assigned_at = this.#last_assigned_at.value;
    }

    /**
     * @type {ValueObjectTimestamp}
     * is initialized in the constructor
     */
    #first_view_at;
    get first_view_at() {
        return this.#first_view_at;
    }

    set first_view_at(value) {
        this.#first_view_at = new ValueObjectTimestamp('first_view_at', value, true);
        this.changedAttributes.first_view_at = value;
    }

    /**
     * @type {ValueObjectUpdateSource}
     * is initialized in the constructor
     */
    #update_source;
    get update_source() {
        return this.#update_source;
    }

    set update_source(value) {
        this.#update_source = new ValueObjectUpdateSource('update_source', value, true);
        this.changedAttributes.update_source = value;
    }

    /**
     * @type {ValueObjectAssignmentChangeType}
     * is initialized in the constructor
     */
    #assignment_change_type;
    get assignment_change_type() {
        return this.#assignment_change_type;
    }

    set assignment_change_type(value) {
        this.#assignment_change_type = new ValueObjectAssignmentChangeType('assignment_change_type', value, true);
        this.changedAttributes.assignment_change_type = value;
    }

    /**
     * Lista de campos válidos para aplicar condiciones de SLA durante transiciones de estado.
     * @private
     * @type {string[]}
     */
    #VALID_TRANSITIONS_SLA_FIELDS = Object.freeze([
        'casos.antiguedad_dias',
        'casos.antiguedad_horas',
        'casos.antiguedad_minutos',
        'casos.state_elapsed_days',
        'casos.state_elapsed_hours',
        'casos.state_elapsed_minutes',
    ]);

    /**
     * Mapa de funciones resolutoras que, dadas ciertas claves de campo SLA,
     * calculan su valor numérico evaluable a partir del contexto del caso.
     *
     * @readonly
     * @type {Object.<string, function(Object): number>}
     */
    #slaFieldResolvers = Object.freeze({
        'casos.antiguedad_dias': () => this.#antiguedadToDays(),
        'casos.antiguedad_horas': () => this.#antiguedadToHour(),
        'casos.antiguedad_minutos': () => this.#antiguedadToMinutes(),
        'casos.state_elapsed_days': () => this.#stateElapsedTimeToDays(),
        'casos.state_elapsed_hours': () => this.#stateElapsedTimeToHour(),
        'casos.state_elapsed_minutes': () => this.#stateElapsedTimeToMinutes(),
    });

    constructor(dto) {
        super(dto.id);
        this.#cliente_id = new ValueObjectUuid('Cliente id', dto.cliente_id);
        this.#transicion_id = new ValueObjectUuid('Transición id', dto.transicion_id);
        this.#estado_id = new ValueObjectUuid('Estado id', dto.estado_id, true);
        this.#responsable_id = new ValueObjectUuid('Responsable id', dto.responsable_id);
        this.#clasificacion_id = new ValueObjectUuid('Clasificación id', dto.clasificacion_id);
        this.#descripcion_caso_id = new ValueObjectUuid('Descripción caso id', dto.descripcion_caso_id);
        this.#cambio_estado_comentario_id = new ValueObjectUuid(
            'Cambio estado comentario',
            dto.cambio_estado_comentario_id,
            true
        );
        this.#caso_clonado_id = new ValueObjectUuid('Caso clonado id', dto.caso_clonado_id, true);
        this.#grupo_id = new ValueObjectUuid('Grupo id', dto.grupo_id);
        this.#fecha_resolucion = new ValueObjectTimestamp('Fecha Resolución', dto.fecha_resolucion, true);
        this.#antiguedad = new ValueObjectAntiguedad('Antiguedad', dto.antiguedad, true);
        this.#ans_posicion = new ValueObjectAnsPosicion('Ans posición', dto.ans_posicion, true);
        this.#antiguedad_dias = new ValueObjectAntiguedadDias('Antiguedad días', dto.antiguedad_dias, true);
        this.#antiguedad_horas = new ValueObjectAntiguedadHoras('Antiguedad horas', dto.antiguedad_horas, true);
        this.#antiguedad_minutos = new ValueObjectAntiguedadMinutos('Antiguedad minutos', dto.antiguedad_minutos, true);
        this.#motivo_baja = new ValueObjectMotivoBaja('Motivo baja', dto.motivo_baja, true);
        this.#alto_impacto = new ValueObjectAltoImpacto('Alto impacto', dto.alto_impacto, true);
        this.#vista = new ValueObjectVista('Vistas', dto.vista, true);
        this.created_at = dto.created_at;
        this.created_by = dto.created_by;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
        this.#expired_at = new ValueObjectTimestamp('Expired at', dto.expired_at, true);
        this.#remaining_time = new ValueObjectString('Remaining time', dto.remaining_time, true);
        this.#cambio_clasificacion = new ValueObjectCambioClasificacion(
            'Cambio clasificación',
            dto.cambio_clasificacion,
            true
        );
        this.#cloned_by = new ValueObjectUuid('Cloned by', dto.cloned_by, true);
        this.#cloned_at = new ValueObjectTimestamp('Cloned at', dto.cloned_at, true);
        this.#reopen_at = new ValueObjectTimestamp('Reopen at', dto.reopen_at, true);
        this.#reopen_by = new ValueObjectUuid('Reopen by', dto.reopen_by, true);
        this.#closed_at = new ValueObjectTimestamp('closed at', dto.closed_at, true);
        this.#closed_by = new ValueObjectUuid('closed by', dto.closed_by, true);
        this.#edited_by = new ValueObjectUuid('edited by', dto.edited_by, true);
        this.#edited_at = new ValueObjectTimestamp('edited at', dto.edited_at, true);
        this.#reference = new ValueObjectInt('Reference', dto.reference, true);
        this.#state_change_at = new ValueObjectTimestamp(
            'State change at',
            dto.state_change_at ?? dto.created_at,
            true
        );
        this.#state_elapsed_days = new ValueObjectAntiguedadDias('State elapsed days', dto.state_elapsed_days, true);
        this.#state_elapsed_hours = new ValueObjectAntiguedadHoras(
            'State elapsed hours',
            dto.state_elapsed_hours,
            true
        );
        this.#state_elapsed_minutes = new ValueObjectAntiguedadMinutos(
            'State elapsed minutes',
            dto.state_elapsed_minutes,
            true
        );
        this.#state_elapsed_time = new ValueObjectAntiguedad('State elapsed time', dto.state_elapsed_time, true);
        this.#external_code = new ValueObjectString('External code', dto.external_code, true);
        this.#folio = new ValueObjectString('Folio', dto.folio, true);
        this.#sla_id = new ValueObjectUuid('sla_id', dto.sla_id, true);
        this.#sla_due_date = new ValueObjectTimestamp('sla_due_date', dto.sla_due_date, true);
        this.#sla_elapsed_time = new ValueObjectString('sla_elapsed_time', dto.sla_elapsed_time, true);
        this.#sla_elapsed_days = new ValueObjectInt('sla_elapsed_days', dto.sla_elapsed_days, true);
        this.#sla_elapsed_hours = new ValueObjectInt('sla_elapsed_hours', dto.sla_elapsed_hours, true);
        this.#sla_elapsed_minutes = new ValueObjectInt('sla_elapsed_minutes', dto.sla_elapsed_minutes, true);
        this.#sla_remaining_time = new ValueObjectString('sla_remaining_time', dto.sla_remaining_time, true);
        this.#sla_remaining_days = new ValueObjectInt('sla_remaining_days', dto.sla_remaining_days, true);
        this.#sla_remaining_hours = new ValueObjectInt('sla_remaining_hours', dto.sla_remaining_hours, true);
        this.#sla_remaining_minutes = new ValueObjectInt('sla_remaining_minutes', dto.sla_remaining_minutes, true);
        this.#sla_position = new ValueObjectInt('sla_position', dto.sla_position, true);
        this.#sla_state_id = new ValueObjectUuid('sla_state_id', dto.sla_state_id, true);
        this.#sla_state_due_date = new ValueObjectTimestamp('sla_state_due_date', dto.sla_state_due_date, true);
        this.#sla_state_elapsed_time = new ValueObjectString(
            'sla_state_elapsed_time',
            dto.sla_state_elapsed_time,
            true
        );
        this.#sla_state_elapsed_days = new ValueObjectInt('sla_state_elapsed_days', dto.sla_state_elapsed_days, true);
        this.#sla_state_elapsed_hours = new ValueObjectInt(
            'sla_state_elapsed_hours',
            dto.sla_state_elapsed_hours,
            true
        );
        this.#sla_state_elapsed_minutes = new ValueObjectInt(
            'sla_state_elapsed_minutes',
            dto.sla_state_elapsed_minutes,
            true
        );
        this.#sla_state_remaining_time = new ValueObjectString(
            'sla_state_remaining_time',
            dto.sla_state_remaining_time,
            true
        );
        this.#sla_state_remaining_days = new ValueObjectInt(
            'sla_state_remaining_days',
            dto.sla_state_remaining_days,
            true
        );
        this.#sla_state_remaining_hours = new ValueObjectInt(
            'sla_state_remaining_hours',
            dto.sla_state_remaining_hours,
            true
        );
        this.#sla_state_remaining_minutes = new ValueObjectInt(
            'sla_state_remaining_minutes',
            dto.sla_state_remaining_minutes,
            true
        );
        this.#sla_state_position = new ValueObjectInt('sla_state_position', dto.sla_state_position, true);
        this.#parent_id = new ValueObjectUuid('parent_id', dto.parent_id, true);
        this.#is_visible = new ValueObjectBoolean('is_visible', dto.is_visible, true);
        this.#last_assigned_at = new ValueObjectTimestamp('last_assigned_at', dto.last_assigned_at, true);
        this.#first_view_at = new ValueObjectTimestamp('first_view_at', dto.first_view_at, true);
        this.#update_source = new ValueObjectUpdateSource('update_source', dto.update_source, true);
        this.#assignment_change_type = new ValueObjectAssignmentChangeType(
            'assignment_change_type',
            dto.assignment_change_type,
            true
        );
    }

    get VALID_TRANSITIONS_SLA_FIELDS() {
        return this.#VALID_TRANSITIONS_SLA_FIELDS;
    }

    get slaFieldResolvers() {
        return this.#slaFieldResolvers;
    }

    static create(dto) {
        return new Case(dto);
    }

    /**
     * @param {string} id
     * @param {string} clonedBy - user performing the clone.
     * @returns {Case}
     */
    clone(id, clonedBy) {
        const now = new Date();
        const dto = {
            ...this.toJson(),
            created_at: now,
            created_by: clonedBy,
            updated_at: now,
            updated_by: clonedBy,
            // Unique per case: the clone must not claim the original's external record.
            external_code: null,
            cloned_by: clonedBy,
            cloned_at: now,
            caso_clonado_id: this.id.value,
            fecha_resolucion: null,
            motivo_baja: null,
            first_view_at: null,
            edited_by: null,
            edited_at: null,
            // A folio identifies one case and one only. Since clone() spreads toJson(),
            // leaving this out would copy the original's folio into the clone and the
            // unique index would reject the insert.
            folio: null,
            id,
        };
        return new Case(dto);
    }

    toJson(allFields = false) {
        let fields = {};

        fields.id = this.id.value;
        fields.cliente_id = this.#cliente_id.value;
        fields.transicion_id = this.#transicion_id.value;
        fields.responsable_id = this.#responsable_id.value;
        fields.clasificacion_id = this.#clasificacion_id.value;
        fields.descripcion_caso_id = this.#descripcion_caso_id.value;
        fields.cambio_estado_comentario_id = this.#cambio_estado_comentario_id.value;
        fields.caso_clonado_id = this.#caso_clonado_id.value;
        fields.grupo_id = this.#grupo_id.value;
        fields.fecha_resolucion = this.#fecha_resolucion.value;
        fields.antiguedad = this.#antiguedad.value;
        fields.ans_posicion = this.#ans_posicion.value;
        fields.antiguedad_dias = this.#antiguedad_dias.value;
        fields.antiguedad_horas = this.#antiguedad_horas.value;
        fields.antiguedad_minutos = this.#antiguedad_minutos.value;
        fields.motivo_baja = this.#motivo_baja.value;
        fields.alto_impacto = this.#alto_impacto.value;
        fields.vista = this.#vista.value;
        fields.created_at = this.created_at.value;
        fields.created_by = this.created_by.value;
        fields.updated_at = this.updated_at.value;
        fields.updated_by = this.updated_by.value;
        fields.deleted_at = this.deleted_at.value;
        fields.deleted_by = this.deleted_by.value;
        fields.expired_at = this.expired_at.value;
        fields.remaining_time = this.remaining_time.value;
        fields.cambio_clasificacion = this.#cambio_clasificacion.value;
        fields.cloned_at = this.#cloned_at.value;
        fields.cloned_by = this.#cloned_by.value;
        fields.reopen_at = this.#reopen_at.value;
        fields.reopen_by = this.#reopen_by.value;
        fields.closed_at = this.#closed_at.value;
        fields.closed_by = this.#closed_by.value;
        fields.edited_by = this.#edited_by.value;
        fields.edited_at = this.#edited_at.value;
        fields.reference = this.#reference.value;
        fields.state_change_at = this.state_change_at.value;
        fields.state_elapsed_days = this.state_elapsed_days.value;
        fields.state_elapsed_hours = this.state_elapsed_hours.value;
        fields.state_elapsed_minutes = this.state_elapsed_minutes.value;
        fields.state_elapsed_time = this.state_elapsed_time.value;
        fields.external_code = this.#external_code.value;
        fields.folio = this.#folio.value;
        fields.sla_id = this.#sla_id.value;
        fields.sla_due_date = this.#sla_due_date.value;
        fields.sla_elapsed_time = this.#sla_elapsed_time.value;
        fields.sla_elapsed_days = this.#sla_elapsed_days.value;
        fields.sla_elapsed_hours = this.#sla_elapsed_hours.value;
        fields.sla_elapsed_minutes = this.#sla_elapsed_minutes.value;
        fields.sla_remaining_time = this.#sla_remaining_time.value;
        fields.sla_remaining_days = this.#sla_remaining_days.value;
        fields.sla_remaining_hours = this.#sla_remaining_hours.value;
        fields.sla_remaining_minutes = this.#sla_remaining_minutes.value;
        fields.sla_position = this.#sla_position.value;
        fields.sla_state_id = this.#sla_state_id.value;
        fields.sla_state_due_date = this.#sla_state_due_date.value;
        fields.sla_state_elapsed_time = this.#sla_state_elapsed_time.value;
        fields.sla_state_elapsed_days = this.#sla_state_elapsed_days.value;
        fields.sla_state_elapsed_hours = this.#sla_state_elapsed_hours.value;
        fields.sla_state_elapsed_minutes = this.#sla_state_elapsed_minutes.value;
        fields.sla_state_remaining_time = this.#sla_state_remaining_time.value;
        fields.sla_state_remaining_days = this.#sla_state_remaining_days.value;
        fields.sla_state_remaining_hours = this.#sla_state_remaining_hours.value;
        fields.sla_state_remaining_minutes = this.#sla_state_remaining_minutes.value;
        fields.sla_state_position = this.#sla_state_position.value;
        fields.parent_id = this.parent_id.value;
        fields.is_visible = this.is_visible.value;
        fields.last_assigned_at = this.#last_assigned_at.value;
        fields.first_view_at = this.#first_view_at.value;
        fields.update_source = this.#update_source.value;
        fields.assignment_change_type = this.#assignment_change_type.value;

        if (allFields === false) {
            delete fields.deleted_at;
            delete fields.deleted_by;
        }
        return fields;
    }

    /**
     * Asigna el caso a un usuario.
     *
     * @param {Object} dto - Objeto de transferencia de datos que contiene la información del usuario.
     * @param {string} dto.responsable_id - ID del responsable.
     * @param {string} dto.grupo_id - ID del grupo.
     * @param {string} dto.updated_at - Marca de tiempo de la última actualización.
     * @param {string} dto.updated_by - ID del usuario que realizó la última actualización.
     */
    assignToUser(dto) {
        this.responsable_id = dto.responsable_id;
        this.grupo_id = dto.grupo_id;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        if (dto.edited_by !== undefined) {
            this.edited_by = dto.edited_by;
        }
        if (dto.edited_at !== undefined) {
            this.edited_at = dto.edited_at;
        }
        this.update_source = dto.update_source;
        this.assignment_change_type = dto.assignment_change_type ?? ValueObjectAssignmentChangeType.MANUAL;
    }

    /**
     * Registra la primera vez que el responsable asignado visualiza el caso.
     * Solo aplica si el usuario indicado es el responsable actual y `first_view_at` sigue en null.
     *
     * @param {string} userId - ID del usuario que visualiza el caso.
     * @param {Date|string} when - Fecha/hora de la visualización.
     * @returns {*} El valor aplicado a `first_view_at`, o `null` si no correspondía registrarlo.
     */
    registerFirstViewBy(userId, when) {
        if (!userId || this.#responsable_id.value !== userId || this.#first_view_at.value !== null) {
            return null;
        }

        this.first_view_at = when;
        return this.#first_view_at.value;
    }

    /**
     * Calcula la antigüedad del caso en días desde el contexto.
     * @returns {number} - Número de días de antigüedad.
     */
    #antiguedadToDays() {
        return this.#antiguedad_dias.value;
    }

    /**
     * Calcula el tiempo transcurrido en el estado actual del caso en días.
     * @returns {number} - Número de días transcurridos en el estado.
     */
    #stateElapsedTimeToDays() {
        return this.#state_elapsed_days.value;
    }

    /**
     * Calcula la antigüedad del caso en horas.
     * @returns {number} - Horas calculadas (días * 24 + horas).
     */
    #antiguedadToHour() {
        return this.#antiguedad_dias.value * 24 + this.#antiguedad_horas.value;
    }

    /**
     * Calcula el tiempo transcurrido en el estado actual del caso en horas.
     * @returns {number} - Horas transcurridas (días * 24 + horas).
     */
    #stateElapsedTimeToHour() {
        return this.#state_elapsed_days.value * 24 + this.#state_elapsed_hours.value;
    }

    /**
     * Calcula la antigüedad del caso en minutos.
     * @returns {number} - Minutos calculados (días * 1440 + horas * 60 + minutos).
     */
    #antiguedadToMinutes() {
        return this.#antiguedad_dias.value * 1440 + this.#antiguedad_horas.value * 60 + this.#antiguedad_minutos.value;
    }

    /**
     * Calcula el tiempo transcurrido en el estado actual del caso en minutos.
     * @returns {number} - Minutos transcurridos (días * 1440 + horas * 60 + minutos).
     */
    #stateElapsedTimeToMinutes() {
        return (
            this.#state_elapsed_days.value * 1440 +
            this.#state_elapsed_hours.value * 60 +
            this.#state_elapsed_minutes.value
        );
    }
}
