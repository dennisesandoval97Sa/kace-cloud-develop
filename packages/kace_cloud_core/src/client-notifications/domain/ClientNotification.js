import { AggregateRoot, ValueObjectBoolean, ValueObjectTimestamp, ValueObjectUuid } from '../../shared';
import { ValueObjectMessage } from './ValueObjectMessage';
import { ValueObjectSubject } from './ValueObjectSubject';

export class ClientNotification extends AggregateRoot {
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #client_id;
    /** @type {ValueObjectSubject} is initialized in the constructor */
    #subject;
    /** @type {ValueObjectMessage} is initialized in the constructor */
    #message;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #start_date;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #end_date;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_read;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #read_by;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_active;

    constructor({
        id,
        client_id,
        subject,
        message,
        start_date,
        end_date,
        is_read,
        read_by,
        is_active,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#client_id = new ValueObjectUuid('client_id', client_id);
        this.#subject = new ValueObjectSubject('subject', subject ?? 'default');
        this.#message = new ValueObjectMessage('message', message ?? 'default');
        this.#start_date = new ValueObjectTimestamp('start_date', start_date ?? new Date());
        this.#end_date = new ValueObjectTimestamp('end_date', end_date ?? new Date(Date.now() + 86400000));
        this.#is_read = new ValueObjectBoolean('is_read', is_read, true);
        this.#read_by = new ValueObjectUuid('read_by', read_by, true);
        this.#is_active = new ValueObjectBoolean('is_active', is_active ?? false);
        this.created_at = created_at;
        this.created_by = created_by;
        this.updated_at = updated_at;
        this.updated_by = updated_by;
        this.deleted_at = deleted_at;
        this.deleted_by = deleted_by;
    }

    get client_id() {
        return this.#client_id;
    }

    set client_id(value) {
        if (this.#client_id.value !== value) {
            this.#client_id = new ValueObjectUuid('client_id', value);
            this.changedAttributes.client_id = value;
        }
    }

    get subject() {
        return this.#subject;
    }

    set subject(value) {
        if (this.#subject.value !== value) {
            this.#subject = new ValueObjectSubject('subject', value);
            this.changedAttributes.subject = value;
        }
    }

    get message() {
        return this.#message;
    }

    set message(value) {
        if (this.#message.value !== value) {
            this.#message = new ValueObjectMessage('message', value);
            this.changedAttributes.message = value;
        }
    }

    get start_date() {
        return this.#start_date;
    }

    set start_date(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#start_date.value !== value) {
            this.#start_date = new ValueObjectTimestamp('start_date', value);
            this.changedAttributes.start_date = value;
        }
    }

    get end_date() {
        return this.#end_date;
    }

    set end_date(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#end_date.value !== value) {
            this.#end_date = new ValueObjectTimestamp('end_date', value, true);
            this.changedAttributes.end_date = value;
        }
    }

    get is_read() {
        return this.#is_read;
    }

    set is_read(value) {
        if (this.#is_read.value !== value) {
            this.#is_read = new ValueObjectBoolean('is_read', value);
            this.changedAttributes.is_read = value;
        }
    }

    get read_by() {
        return this.#read_by;
    }

    set read_by(value) {
        if (this.#read_by.value !== value) {
            this.#read_by = new ValueObjectUuid('read_by', value, true);
            this.changedAttributes.read_by = value;
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
     * Creates a new ClientNotification object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the ClientNotification object.
     * @returns {ClientNotification} A new instance of the ClientNotification class.
     */
    static create(dto) {
        return new ClientNotification(dto);
    }
}
