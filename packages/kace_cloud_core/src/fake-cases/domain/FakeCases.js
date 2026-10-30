import { AggregateRoot, ValueObjectTimestamp, ValueObjectUuid } from '../../shared/index.js';
import { ValueObjectCanalId } from '../../cases/domain/ValueObjectCanalId.js';
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
} from '../../cases/index.js';

export default class FakeCases extends AggregateRoot {
    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #cliente_id;

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #transicion_id;

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #responsable_id;

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #clasificacion_id;

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #descripcion_caso_id;

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #caso_clonado_id;

    /**
     * @type {ValueObjectCanalId}
     * is initialized in the constructor
     */
    #canal_id;

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #grupo_id;

    /**
     * @type {ValueObjectTimestamp}
     * is initialized in the constructor
     */
    #fecha_resolucion;

    /**
     * @type {ValueObjectAntiguedad}
     * is initialized in the constructor
     */
    #antiguedad;

    /**
     * @type {ValueObjectAnsPosicion}
     * is initialized in the constructor
     */
    #ans_posicion;

    /**
     * @type {ValueObjectAntiguedadDias}
     * is initialized in the constructor
     */
    #antiguedad_dias;

    /**
     * @type {ValueObjectAntiguedadHoras}
     * is initialized in the constructor
     */
    #antiguedad_horas;

    /**
     * @type {ValueObjectAntiguedadMinutos}
     * is initialized in the constructor
     */
    #antiguedad_minutos;

    /**
     * @type {ValueObjectMotivoBaja}
     * is initialized in the constructor
     */
    #motivo_baja;

    /**
     * @type {ValueObjectAltoImpacto}
     * is initialized in the constructor
     */
    #alto_impacto;

    /**
     * @type {ValueObjectVista}
     * is initialized in the constructor
     */
    #vista;

    /**
     * @type {ValueObjectCambioClasificacion}
     * is initialized in the constructor
     */
    #cambio_clasificacion;

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #cambio_estado_comentario_id;

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #cloned_by;

    /**
     * @type {ValueObjectTimestamp}
     * is initialized in the constructor
     */
    #cloned_at;

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #reopen_by;

    /**
     * @type {ValueObjectTimestamp}
     * is initialized in the constructor
     */
    #reopen_at;

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #asignacion_agente = null;

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #asignacion_grupo = null;

    /**
     * @type {ValueObjectUuid}
     *  is initialized in the constructor
     */
    #closed_by;

    /**
     * @type {ValueObjectTimestamp}
     * is initialized in the constructor
     */
    #closed_at;

    /**
     * @type {ValueObjectUuid}
     * is initialized in the constructor
     */
    #edited_by;

    /**
     * @type {ValueObjectTimestamp}
     * is initialized in the constructor
     */
    #edited_at;

    constructor(dto) {
        super(dto.id);
        this.#cliente_id = new ValueObjectUuid('Cliente id', dto.cliente_id, true);
        this.#transicion_id = new ValueObjectUuid('Transición id', dto.transicion_id, true);
        this.#responsable_id = new ValueObjectUuid('Responsable id', dto.responsable_id, true);
        this.#clasificacion_id = new ValueObjectUuid('Clasificación id', dto.clasificacion_id, true);
        this.#descripcion_caso_id = new ValueObjectUuid('Descripción caso id', dto.descripcion_caso_id, true);
        this.#caso_clonado_id = new ValueObjectUuid('Caso clonado id', dto.caso_clonado_id, true);
        this.#cambio_estado_comentario_id = new ValueObjectUuid(
            'Cambio estado comentario',
            dto.cambio_estado_comentario_id,
            true
        );
        this.#canal_id = new ValueObjectCanalId('Canal id', dto.canal_id, true);
        this.#grupo_id = new ValueObjectUuid('Grupo id', dto.grupo_id, true);
        this.#fecha_resolucion = new ValueObjectTimestamp('Fecha Resolución', dto.fecha_resolucion, true);
        this.#antiguedad = new ValueObjectAntiguedad('Antiguedad', dto.antiguedad, true);
        this.#ans_posicion = new ValueObjectAnsPosicion('Ans posición', dto.ans_posicion, true);
        this.#antiguedad_dias = new ValueObjectAntiguedadDias('Antiguedad días', dto.antiguedad_dias, true);
        this.#antiguedad_horas = new ValueObjectAntiguedadHoras('Antiguedad horas', dto.antiguedad_horas, true);
        this.#antiguedad_minutos = new ValueObjectAntiguedadMinutos('Antiguedad minutos', dto.antiguedad_minutos, true);
        this.#motivo_baja = new ValueObjectMotivoBaja('Motivo baja', dto.motivo_baja, true);
        this.#alto_impacto = new ValueObjectAltoImpacto('Alto impacto', dto.alto_impacto, true);
        this.#vista = new ValueObjectVista('Vistas', dto.vista, true);
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

        this.created_at = dto.created_at;
        this.created_by = dto.created_by;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    get cliente_id() {
        return this.#cliente_id;
    }

    set cliente_id(value) {
        this.#cliente_id = new ValueObjectUuid('Cliente id', value, true);
        this.changedAttributes.cliente_id = value;
    }

    get transicion_id() {
        return this.#transicion_id;
    }

    set transicion_id(value) {
        this.#transicion_id = new ValueObjectUuid('Transición id', value, true);
        this.changedAttributes.transicion_id = value;
    }

    get responsable_id() {
        return this.#responsable_id;
    }

    set responsable_id(value) {
        this.#responsable_id = new ValueObjectUuid('Responsable id', value, true);
        this.changedAttributes.responsable_id = value;
    }

    get clasificacion_id() {
        return this.#clasificacion_id;
    }

    set clasificacion_id(value) {
        this.#clasificacion_id = new ValueObjectUuid('Clasificación id', value, true);
        this.changedAttributes.clasificacion_id = value;
    }

    get descripcion_caso_id() {
        return this.#descripcion_caso_id;
    }

    set descripcion_caso_id(value) {
        this.#descripcion_caso_id = new ValueObjectUuid('Descripción caso id', value, true);
        this.changedAttributes.descripcion_caso_id = value;
    }

    get caso_clonado_id() {
        return this.#caso_clonado_id;
    }

    set caso_clonado_id(value) {
        this.#caso_clonado_id = new ValueObjectUuid('Caso clonado id', value, true);
        this.changedAttributes.caso_clonado_id = value;
    }

    get canal_id() {
        return this.#canal_id;
    }

    set canal_id(value) {
        this.#canal_id = new ValueObjectCanalId('Canal id', value, true);
        this.changedAttributes.canal_id = value;
    }

    get grupo_id() {
        return this.#grupo_id;
    }

    set grupo_id(value) {
        this.#grupo_id = new ValueObjectUuid('Grupo id', value, true);
        this.changedAttributes.grupo_id = value;
    }

    get fecha_resolucion() {
        return this.#fecha_resolucion;
    }

    set fecha_resolucion(value) {
        this.#fecha_resolucion = new ValueObjectTimestamp('Fecha resolución', value, true);
        this.changedAttributes.fecha_resolucion = value;
    }

    get antiguedad() {
        return this.#antiguedad;
    }

    set antiguedad(value) {
        this.#antiguedad = new ValueObjectAntiguedad('Antiguedad', value, true);
        this.changedAttributes.antiguedad = value;
    }

    get ans_posicion() {
        return this.#ans_posicion;
    }

    set ans_posicion(value) {
        this.#ans_posicion = new ValueObjectAnsPosicion('Ans posición', value, true);
        this.changedAttributes.ans_posicion = value;
    }

    get antiguedad_dias() {
        return this.#antiguedad_dias;
    }

    set antiguedad_dias(value) {
        this.#antiguedad_dias = new ValueObjectAntiguedadDias('Antiguedad días', value, true);
        this.changedAttributes.antiguedad_dias = value;
    }

    get antiguedad_horas() {
        return this.#antiguedad_horas;
    }

    set antiguedad_horas(value) {
        this.#antiguedad_horas = new ValueObjectAntiguedadHoras('Antiguedad horas', value, true);
        this.changedAttributes.antiguedad_horas = value;
    }

    get antiguedad_minutos() {
        return this.#antiguedad_minutos;
    }

    set antiguedad_minutos(value) {
        this.#antiguedad_minutos = new ValueObjectAntiguedadMinutos('Antiguedad minutos', value, true);
        this.changedAttributes.antiguedad_minutos = value;
    }

    get motivo_baja() {
        return this.#motivo_baja;
    }

    set motivo_baja(value) {
        this.#motivo_baja = new ValueObjectMotivoBaja('Motivo baja', value, true);
        this.changedAttributes.motivo_baja = value;
    }

    get alto_impacto() {
        return this.#alto_impacto;
    }

    set alto_impacto(value) {
        this.#alto_impacto = new ValueObjectAltoImpacto('Alto impacto', value, true);
        this.changedAttributes.alto_impacto = value;
    }

    get vista() {
        return this.#vista;
    }

    set vista(value) {
        this.#vista = new ValueObjectVista('Vista', value, true);
        this.changedAttributes.vista = value;
    }

    get cambio_estado_comentario_id() {
        return this.#cambio_estado_comentario_id;
    }

    set cambio_estado_comentario_id(value) {
        this.#cambio_estado_comentario_id = new ValueObjectUuid('Cambio estado comentario id', value, true);
        this.changedAttributes.cambio_estado_comentario_id = value;
    }

    get cambio_clasificacion() {
        return this.#cambio_clasificacion;
    }

    set cambio_clasificacion(value) {
        this.#cambio_clasificacion = new ValueObjectCambioClasificacion('Cambio clasificación', value, true);
        this.changedAttributes.cambio_clasificacion = value;
    }

    get cloned_at() {
        return this.#cloned_at;
    }

    set cloned_at(value) {
        this.#cloned_at = new ValueObjectTimestamp('Cloned at', value, true);
        this.changedAttributes.cloned_at = value;
    }

    get cloned_by() {
        return this.#cloned_by;
    }

    set cloned_by(value) {
        this.#cloned_by = new ValueObjectUuid('Cloned by', value, true);
        this.changedAttributes.cloned_by = value;
    }

    get reopen_by() {
        return this.#reopen_by;
    }

    set reopen_by(value) {
        this.#reopen_by = new ValueObjectUuid('Reopen by', value, true);
        this.changedAttributes.reopen_by = value;
    }

    get reopen_at() {
        return this.#reopen_at;
    }

    set reopen_at(value) {
        this.#reopen_at = new ValueObjectTimestamp('Reopen at', value, true);
        this.changedAttributes.reopen_at = value;
    }

    get closed_by() {
        return this.#closed_by;
    }

    set closed_by(value) {
        this.#closed_by = new ValueObjectUuid('closed by', value, true);
        this.changedAttributes.closed_by = value;
    }

    get closed_at() {
        return this.#closed_at;
    }

    set closed_at(value) {
        this.#closed_at = new ValueObjectTimestamp('closed at', value, true);
        this.changedAttributes.closed_at = value;
    }

    get edited_by() {
        return this.#edited_by;
    }

    set edited_by(value) {
        this.#edited_by = new ValueObjectUuid('edited by', value, true);
        this.changedAttributes.edited_by = value;
    }

    get edited_at() {
        return this.#edited_at;
    }

    set edited_at(value) {
        this.#edited_at = new ValueObjectTimestamp('edited at', value, true);
        this.changedAttributes.edited_at = value;
    }

    get asignacion_agente() {
        return this.#asignacion_agente;
    }

    set asignacion_agente(value) {
        this.#asignacion_agente = new ValueObjectUuid('asignacion_agente', value, true);
    }

    get asignacion_grupo() {
        return this.#asignacion_grupo;
    }

    set asignacion_grupo(value) {
        this.#asignacion_grupo = new ValueObjectUuid('asignacion_grupo', value, true);
    }

    static create(dto) {
        return new FakeCases(dto);
    }

    clone(id) {
        const dto = {
            ...this.toJson(),
            created_at: new Date(),
            cloned_by: this.updated_by.value,
            cloned_at: new Date(),
            caso_clonado_id: this.id.value,
            fecha_resolucion: null,
            motivo_baja: null,
            edited_by: null,
            edited_at: null,
            id,
        };
        return new FakeCases(dto);
    }

    toJson() {
        return {
            id: this.id.value,
            cliente_id: this.#cliente_id.value,
            transicion_id: this.#transicion_id.value,
            responsable_id: this.#responsable_id.value,
            clasificacion_id: this.#clasificacion_id.value,
            descripcion_caso_id: this.#descripcion_caso_id.value,
            canal_id: this.#canal_id.value,
            grupo_id: this.#grupo_id.value,
            antiguedad: this.#antiguedad.value,
            ans_posicion: this.#ans_posicion.value,
            antiguedad_dias: this.#antiguedad_dias.value,
            antiguedad_horas: this.#antiguedad_horas.value,
            antiguedad_minutos: this.#antiguedad_minutos.value,
            motivo_baja: this.#motivo_baja.value,
            alto_impacto: this.#alto_impacto.value,
            vista: this.#vista.value,
            cambio_estado_comentario_id: this.#cambio_estado_comentario_id.value,
            caso_clonado_id: this.#caso_clonado_id.value,
            cambio_clasificacion: this.#cambio_clasificacion.value,
            cloned_by: this.#cloned_by.value,
            cloned_at: this.#cloned_at.value,
            reopen_at: this.#reopen_at.value,
            reopen_by: this.#reopen_by.value,
            edited_by: this.#edited_by.value,
            edited_at: this.#edited_at.value,
            created_at: this.created_at.value,
            created_by: this.created_by.value,
            updated_at: this.updated_at.value,
            updated_by: this.updated_by.value,
        };
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
    }
}
