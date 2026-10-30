import {
    AggregateRoot,
    ValueObjectEmail,
    ValueObjectInt,
    ValueObjectName,
    ValueObjectTimestamp,
    ValueObjectUuid,
} from '../../shared/index.js';
import {
    ValueObjectDocumentType,
    ValueObjectExtraFields,
    ValueObjectHabeasData,
    ValueObjectIdCard,
    ValueObjectMartialStatus,
    ValueObjectPhone,
    ValueObjectSexo,
} from '../../clients/index.js';
import { VONombreEmpresa } from '../../clients/domain/valueObjects/VONombreEmpresa.js';
import { ValueObjectClientName } from '../../clients/domain/valueObjects/ValueObjectClientName.js';

export class FakeClient extends AggregateRoot {
    /** @type {ValueObjectName} is initialized in the constructor */
    #tipo_cliente;
    /** @type {ValueObjectDocumentType} is initialized in the constructor */
    #tipo_documento;
    /** @type {ValueObjectIdCard} is initialized in the constructor */
    #documento;
    /** @type {ValueObjectClientName} is initialized in the constructor */
    #nombres;
    /** @type {ValueObjectClientName} is initialized in the constructor */
    #apellido1;
    /** @type {ValueObjectClientName} is initialized in the constructor */
    #apellido2;
    /** @type {ValueObjectSexo} is initialized in the constructor */
    #sexo;
    /** @type {ValueObjectMartialStatus} is initialized in the constructor */
    #estado_civil;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #fecha_nacimiento;
    /** @type {ValueObjectEmail} is initialized in the constructor */
    #email;
    /** @type {ValueObjectEmail} is initialized in the constructor */
    #email_alterno;
    /** @type {ValueObjectPhone} is initialized in the constructor */
    #telefono;
    /** @type {ValueObjectPhone} is initialized in the constructor */
    #telefono_alterno;
    /** @type {ValueObjectExtraFields} is initialized in the constructor */
    #campos_extra1;
    /** @type {ValueObjectExtraFields} is initialized in the constructor */
    #campos_extra2;
    /** @type {ValueObjectExtraFields} is initialized in the constructor */
    #campos_extra3;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #status;
    /** @type {ValueObjectHabeasData} is initialized in the constructor */
    #habeas_data;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #padre_id;
    /** @this {ValueObjectName} */
    #nombre_empresa; // is initialized in the constructor

    constructor(dto) {
        super(dto.id);
        this.#tipo_cliente = new ValueObjectName('tipo_cliente', dto.tipo_cliente, true);
        this.#tipo_documento = new ValueObjectDocumentType('tipo_documento', dto.tipo_documento, true);
        this.#documento = new ValueObjectIdCard('documento', dto.documento, true);
        this.#nombres = new ValueObjectClientName('nombres', dto.nombres, true);
        this.#apellido1 = new ValueObjectClientName('apellido1', dto.apellido1, true);
        this.#apellido2 = new ValueObjectClientName('apellido2', dto.apellido2, true);
        this.#nombre_empresa = new VONombreEmpresa('nombre_empresa', dto.nombre_empresa, true);
        this.#sexo = new ValueObjectSexo('sexo', dto.sexo, true);
        this.#estado_civil = new ValueObjectMartialStatus('estado_civil', dto.estado_civil, true);
        this.#fecha_nacimiento = new ValueObjectTimestamp('fecha_nacimiento', dto.fecha_nacimiento, true);
        this.#email = new ValueObjectEmail('email', dto.email, true);
        this.#email_alterno = new ValueObjectEmail('email_alterno', dto.email_alterno, true);
        this.#telefono = new ValueObjectPhone('telefono', dto.telefono, true);
        this.#telefono_alterno = new ValueObjectPhone('telefono_alterno', dto.telefono_alterno, true);
        this.#campos_extra1 = new ValueObjectExtraFields('campos_extra1', dto.campos_extra1, true);
        this.#campos_extra2 = new ValueObjectExtraFields('campos_extra2', dto.campos_extra2, true);
        this.#campos_extra3 = new ValueObjectExtraFields('campos_extra3', dto.campos_extra3, true);
        this.#status = new ValueObjectInt('status', dto.status, true);
        this.#habeas_data = new ValueObjectHabeasData('habeas_data', dto.habeas_data, true);
        this.#padre_id = new ValueObjectUuid('padre_id', dto.padre_id, true);
        this.created_at = dto.created_at;
        this.created_by = dto.created_by;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    get tipo_cliente() {
        return this.#tipo_cliente;
    }

    set tipo_cliente(value) {
        if (this.#tipo_cliente.value !== value) {
            this.#tipo_cliente = new ValueObjectName('tipo_cliente', value, true);
            this.changedAttributes.tipo_cliente = value;
        }
    }

    get tipo_documento() {
        return this.#tipo_documento;
    }

    set tipo_documento(value) {
        if (this.#tipo_documento.value !== value) {
            this.#tipo_documento = new ValueObjectDocumentType('tipo_documento', value, true);
            this.changedAttributes.tipo_documento = value;
        }
    }

    get documento() {
        return this.#documento;
    }

    set documento(value) {
        if (this.#documento.value !== value) {
            this.#documento = new ValueObjectIdCard('documento', value, true);
            this.changedAttributes.documento = value;
        }
    }

    get nombres() {
        return this.#nombres;
    }

    set nombres(value) {
        if (this.#nombres.value !== value) {
            this.#nombres = new ValueObjectClientName('nombres', value, true);
            this.changedAttributes.nombres = value;
        }
    }

    get apellido1() {
        return this.#apellido1;
    }

    set apellido1(value) {
        if (this.#apellido1.value !== value) {
            this.#apellido1 = new ValueObjectClientName('apellido1', value, true);
            this.changedAttributes.apellido1 = value;
        }
    }

    get apellido2() {
        return this.#apellido2;
    }

    set apellido2(value) {
        if (this.#apellido2.value !== value) {
            this.#apellido2 = new ValueObjectClientName('apellido2', value, true);
            this.changedAttributes.apellido2 = value;
        }
    }

    get sexo() {
        return this.#sexo;
    }

    set sexo(value) {
        if (this.#sexo.value !== value) {
            this.#sexo = new ValueObjectSexo('sexo', value, true);
            this.changedAttributes.sexo = value;
        }
    }

    get estado_civil() {
        return this.#estado_civil;
    }

    set estado_civil(value) {
        if (this.#estado_civil.value !== value) {
            this.#estado_civil = new ValueObjectMartialStatus('estado_civil', value, true);
            this.changedAttributes.estado_civil = value;
        }
    }

    get fecha_nacimiento() {
        return this.#fecha_nacimiento;
    }

    set fecha_nacimiento(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#fecha_nacimiento.value !== value) {
            this.#fecha_nacimiento = new ValueObjectTimestamp('fecha_nacimiento', value, true);
            this.changedAttributes.fecha_nacimiento = value;
        }
    }

    get email() {
        return this.#email;
    }

    set email(value) {
        if (this.#email.value !== value) {
            this.#email = new ValueObjectEmail('email', value, true);
            this.changedAttributes.email = value;
        }
    }

    get email_alterno() {
        return this.#email_alterno;
    }

    set email_alterno(value) {
        if (this.#email_alterno.value !== value) {
            this.#email_alterno = new ValueObjectEmail('email_alterno', value, true);
            this.changedAttributes.email_alterno = value;
        }
    }

    get telefono() {
        return this.#telefono;
    }

    set telefono(value) {
        if (this.#telefono.value !== value) {
            this.#telefono = new ValueObjectPhone('telefono', value, true);
            this.changedAttributes.telefono = value;
        }
    }

    get telefono_alterno() {
        return this.#telefono_alterno;
    }

    set telefono_alterno(value) {
        if (this.#telefono_alterno.value !== value) {
            this.#telefono_alterno = new ValueObjectPhone('telefono_alterno', value, true);
            this.changedAttributes.telefono_alterno = value;
        }
    }

    get campos_extra1() {
        return this.#campos_extra1;
    }

    set campos_extra1(value) {
        if (this.#campos_extra1.value !== value) {
            this.#campos_extra1 = new ValueObjectExtraFields('campos_extra1', value, true);
            this.changedAttributes.campos_extra1 = value;
        }
    }

    get campos_extra2() {
        return this.#campos_extra2;
    }

    set campos_extra2(value) {
        if (this.#campos_extra2.value !== value) {
            this.#campos_extra2 = new ValueObjectExtraFields('campos_extra2', value, 100, true);
            this.changedAttributes.campos_extra2 = value;
        }
    }

    get campos_extra3() {
        return this.#campos_extra3;
    }

    set campos_extra3(value) {
        if (this.#campos_extra3.value !== value) {
            this.#campos_extra3 = new ValueObjectExtraFields('campos_extra3', value, 100, true);
            this.changedAttributes.campos_extra3 = value;
        }
    }

    get status() {
        return this.#status;
    }

    set status(value) {
        if (this.#status.value !== value) {
            this.#status = new ValueObjectInt('status', value, true);
            this.changedAttributes.status = value;
        }
    }

    get habeas_data() {
        return this.#habeas_data;
    }

    set habeas_data(value) {
        if (this.#habeas_data.value !== value) {
            this.#habeas_data = new ValueObjectHabeasData('habeas_data', value, true);
            this.changedAttributes.habeas_data = value;
        }
    }

    get padre_id() {
        return this.#padre_id;
    }

    set padre_id(value) {
        if (this.#padre_id.value !== value) {
            this.#padre_id = new ValueObjectUuid('padre_id', value, true);
            this.changedAttributes.padre_id = value;
        }
    }

    get nombre_empresa() {
        return this.#nombre_empresa;
    }

    set nombre_empresa(value) {
        if (this.#nombre_empresa.value !== value) {
            this.#nombre_empresa = new VONombreEmpresa('nombre_empresa', value, true);
            this.changedAttributes.nombre_empresa = value;
        }
    }

    /**
     * Creates a new Client object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the Client object.
     * @returns {FakeClient} A new instance of the Client class.
     */
    static create(dto) {
        return new FakeClient(dto);
    }
}
