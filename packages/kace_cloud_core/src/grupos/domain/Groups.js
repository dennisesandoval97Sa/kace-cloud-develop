import {
    AggregateRoot,
    StatusEnum,
    ValueObjectCodigoExterno,
    ValueObjectInt,
    ValueObjectJson,
    ValueObjectStatus,
    ValueObjectUuid,
} from '../../shared/index.js';
import {
    ValueObjectCodigosExternos,
    ValueObjectComportamientos,
    ValueObjectDescription,
    ValueObjectFilterOrder,
    ValueObjectGroupName,
    ValueObjectLayouts,
    ValueObjectPermissions,
} from '../index';

export class Groups extends AggregateRoot {
    /** @type {ValueObjectGroupName} is initialized in the constructor */
    #nombre;
    /** @type {ValueObjectStatus} is initialized in the constructor */
    #status;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #horario_id;
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #descripcion;
    /** @type {ValueObjectCodigoExterno} is initialized in the constructor */
    #codigo_externo;
    /** @type {ValueObjectCodigosExternos} is initialized in the constructor */
    #codigos_externos;
    /** @type {ValueObjectPermissions} is initialized in the constructor */
    #permisos;
    /** @type {ValueObjectLayouts} is initialized in the constructor */
    #layouts;
    /** @type {ValueObjectComportamientos} is initialized in the constructor */
    #comportamientos;
    /** @type {ValueObjectFilterOrder} is initialized in the constructor */
    #filter_order;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #expiredCasesCount = null;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #intermediateCasesCount = null;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #notExpiredCasesCount = null;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #rol_id;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #data;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #ips_allowed;

    #configuration_id;

    constructor(dto) {
        super(dto.id);
        this.#nombre = new ValueObjectGroupName('nombre', dto.nombre ?? 'default');
        this.#status = new ValueObjectStatus('status', dto.status);
        this.#horario_id = new ValueObjectUuid('Horario id', dto.horario_id);
        this.#descripcion = new ValueObjectDescription('descripción', dto.descripcion, true);
        this.#codigo_externo = new ValueObjectCodigoExterno('Código externo', dto.codigo_externo, true);
        this.#codigos_externos = new ValueObjectCodigosExternos('Códigos Externos', dto.codigos_externos, true);
        this.#permisos = new ValueObjectPermissions('permisos', dto.permisos, true);
        this.#layouts = new ValueObjectLayouts('Layouts', dto.layouts, true);
        this.#comportamientos = new ValueObjectComportamientos('comportamientos', dto.comportamientos, true);
        this.#filter_order = new ValueObjectFilterOrder('filter order', dto.filter_order, true);
        this.#rol_id = new ValueObjectUuid('rol_id', dto.rol_id, true);
        this.#expiredCasesCount = new ValueObjectInt('expiredCasesCount', dto.expiredCasesCount ?? 0, true);
        this.#intermediateCasesCount = new ValueObjectInt('expired_cases', dto.intermediateCasesCount ?? 0, true);
        this.#notExpiredCasesCount = new ValueObjectInt('expired_cases', dto.notExpiredCasesCount ?? 0, true);
        this.#data = new ValueObjectJson('data', dto.data, true);
        this.#ips_allowed = new ValueObjectJson('ips_allowed', dto.ips_allowed, true);

        this.#configuration_id = new ValueObjectUuid('configuration_id', dto.configuration_id, true);

        this.created_by = dto.created_by;
        this.created_at = dto.created_at;
        this.updated_by = dto.updated_by;
        this.updated_at = dto.updated_at;
        this.deleted_by = dto.deleted_by;
        this.deleted_at = dto.deleted_at;
    }

    static create(dto) {
        return new Groups(dto);
    }

    get nombre() {
        return this.#nombre;
    }

    set nombre(value) {
        this.#nombre = new ValueObjectGroupName('nombre', value);
        this.changedAttributes.nombre = this.#nombre.value;
    }

    get status() {
        return this.#status;
    }

    set status(value) {
        this.#status = new ValueObjectStatus('status', value);
        this.changedAttributes.status = this.#status.value;
    }

    /**
     * A group is usable for assignments only while it is ACTIVE and not soft-deleted.
     * @returns {boolean}
     */
    isActive() {
        if (this.deleted_at?.value || this.deleted_by?.value) {
            return false;
        }

        return Number(this.#status?.value) === StatusEnum.ACTIVE.value;
    }

    get horario_id() {
        return this.#horario_id;
    }

    set horario_id(value) {
        this.#horario_id = new ValueObjectUuid('Horario id', value);
        this.changedAttributes.horario_id = this.#horario_id.value;
    }

    get rol_id() {
        return this.#rol_id;
    }

    set rol_id(value) {
        this.#rol_id = new ValueObjectUuid('rol_id', value);
        this.changedAttributes.rol_id = this.#rol_id.value;
    }

    get descripcion() {
        return this.#descripcion;
    }

    set descripcion(value) {
        this.#descripcion = new ValueObjectDescription('descripción', value);
        this.changedAttributes.descripcion = this.#descripcion.value;
    }

    get codigo_externo() {
        return this.#codigo_externo;
    }

    set codigo_externo(value) {
        this.#codigo_externo = new ValueObjectCodigoExterno('Código externo', value);
        this.changedAttributes.codigo_externo = this.#codigo_externo.value;
    }

    get codigos_externos() {
        return this.#codigos_externos;
    }

    set codigos_externos(value) {
        this.#codigos_externos = new ValueObjectCodigosExternos('Códigos Externos', value);
        this.changedAttributes.codigos_externos = this.#codigos_externos.value;
    }

    get permisos() {
        return this.#permisos;
    }

    set permisos(value) {
        this.#permisos = new ValueObjectPermissions('permisos', value);
        this.changedAttributes.permisos = this.#permisos.value;
    }

    get layouts() {
        return this.#layouts;
    }

    set layouts(value) {
        this.#layouts = new ValueObjectLayouts('Layouts', value);
        this.changedAttributes.layouts = this.#layouts.value;
    }

    get comportamientos() {
        return this.#comportamientos;
    }

    set comportamientos(value) {
        this.#comportamientos = new ValueObjectComportamientos('comportamientos', value);
        this.changedAttributes.comportamientos = JSON.stringify(this.#comportamientos.value);
    }

    get filter_order() {
        return this.#filter_order;
    }

    set filter_order(value) {
        this.#filter_order = new ValueObjectFilterOrder('filter order', value);
        this.changedAttributes.filter_order = this.#filter_order.value;
    }

    get expiredCasesCount() {
        return this.#expiredCasesCount;
    }

    set expiredCasesCount(value) {
        this.#expiredCasesCount = new ValueObjectJson('expired_cases', value, true);
    }
    get intermediateCasesCount() {
        return this.#intermediateCasesCount;
    }

    set intermediateCasesCount(value) {
        this.#intermediateCasesCount = new ValueObjectJson('intermediate_cases', value, true);
    }

    get notExpiredCasesCount() {
        return this.#notExpiredCasesCount;
    }

    set notExpiredCasesCount(value) {
        this.#notExpiredCasesCount = new ValueObjectJson('not_expired_cases', value, true);
    }

    get configuration_id() {
        return this.#configuration_id;
    }

    set configuration_id(value) {
        this.#configuration_id = new ValueObjectUuid('configuration_id', value);
        this.changedAttributes.configuration_id = this.#configuration_id.value;
    }
    get data() {
        return this.#data;
    }

    set data(value) {
        if (this.#data !== value) {
            this.#data = new ValueObjectJson('data', value, true);
            this.changedAttributes.data = value;
        }
    }

    get ips_allowed() {
        return this.#ips_allowed;
    }

    set ips_allowed(value) {
        if (this.#ips_allowed !== value) {
            this.#ips_allowed = new ValueObjectJson('ips_allowed', value, true);
            this.changedAttributes.ips_allowed = value;
        }
    }
}
