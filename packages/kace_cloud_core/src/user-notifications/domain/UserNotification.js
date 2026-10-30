import { AggregateRoot, ValueObjectBoolean, ValueObjectTimestamp, ValueObjectUuid } from '../../shared';
import { ValueObjectMessage } from './ValueObjectMessage';
import { ValueObjectSubject } from './ValueObjectSubject';

export class UserNotification extends AggregateRoot {
    /** @type {ValueObjectSubject} is initialized in the constructor */
    #asunto;
    /** @type {ValueObjectMessage} is initialized in the constructor */
    #mensaje;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #fecha_inicio;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #fecha_fin;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #leida;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #leida_por;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #user_id;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_active;

    constructor({
        id,
        asunto,
        mensaje,
        fecha_inicio,
        fecha_fin,
        leida,
        leida_por,
        user_id,
        is_active,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#asunto = new ValueObjectSubject('asunto', asunto ?? 'default');
        this.#mensaje = new ValueObjectMessage('mensaje', mensaje ?? 'default');
        this.#fecha_inicio = new ValueObjectTimestamp('fecha_inicio', fecha_inicio ?? new Date());
        this.#fecha_fin = new ValueObjectTimestamp('fecha_fin', fecha_fin ?? new Date(Date.now() + 86400000));
        this.#leida = new ValueObjectBoolean('leida', leida ?? false);
        this.#leida_por = new ValueObjectUuid('leida_por', leida_por, true);
        this.#user_id = new ValueObjectUuid('user_id', user_id);
        this.#is_active = new ValueObjectBoolean('is_active', is_active ?? false);
        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
    }

    get asunto() {
        return this.#asunto;
    }

    set asunto(value) {
        if (this.#asunto.value !== value) {
            this.#asunto = new ValueObjectSubject('asunto', value);
            this.changedAttributes.asunto = value;
        }
    }

    get mensaje() {
        return this.#mensaje;
    }

    set mensaje(value) {
        if (this.#mensaje.value !== value) {
            this.#mensaje = new ValueObjectMessage('mensaje', value);
            this.changedAttributes.mensaje = value;
        }
    }

    get fecha_inicio() {
        return this.#fecha_inicio;
    }

    set fecha_inicio(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#fecha_inicio.value !== value) {
            this.#fecha_inicio = new ValueObjectTimestamp('fecha_inicio', value);
            this.changedAttributes.fecha_inicio = value;
        }
    }

    get fecha_fin() {
        return this.#fecha_fin;
    }

    set fecha_fin(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#fecha_fin.value !== value) {
            this.#fecha_fin = new ValueObjectTimestamp('fecha_fin', value);
            this.changedAttributes.fecha_fin = value;
        }
    }

    get leida() {
        return this.#leida;
    }

    set leida(value) {
        if (this.#leida.value !== value) {
            this.#leida = new ValueObjectBoolean('leida', value);
            this.changedAttributes.leida = value;
        }
    }

    get leida_por() {
        return this.#leida_por;
    }

    set leida_por(value) {
        if (this.#leida_por.value !== value) {
            this.#leida_por = new ValueObjectUuid('leida_por', value);
            this.changedAttributes.leida_por = value;
        }
    }

    get user_id() {
        return this.#user_id;
    }

    set user_id(value) {
        if (this.#user_id.value !== value) {
            this.#user_id = new ValueObjectUuid('user_id', value);
            this.changedAttributes.user_id = value;
        }
    }

    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        if (this.#is_active.value !== value) {
            this.#is_active = new ValueObjectBoolean('is_active', value);
            this.changedAttributes.is_active = value;
        }
    }

    /**
     * Creates a new UserNotification object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the UserNotification object.
     * @returns {UserNotification} A new instance of the UserNotification class.
     */
    static create(dto) {
        return new UserNotification(dto);
    }
}
