import { AggregateRoot } from '../../shared/domain/AggregateRoot.js';
import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid.js';
import { ValueObjectBoolean } from '../../shared/domain/value-object/ValueObjectBoolean.js';
import { VOTableName } from './VOTableName.js';
import VOName from './VOName.js';
import { VOLogsTableName } from './VOLogsTableName.js';

export class AuxDefinition extends AggregateRoot {
    /* type {VOName} */
    #name;
    /* type {VOTableName} */
    #tablename;
    /* type {VOLogsTableName} */
    #logs_tablename;
    /* type {ValueObjectUuid} */
    #schema_id;
    /* type {ValueObjectUuid} */
    #restflow_id;
    /* type {ValueObjectBoolean} */
    #is_active;

    /**
     * @param {Object} params
     * @param {string} params.id
     * @param {string} params.name
     * @param {string} params.tablename
     * @param {string} params.logs_tablename
     * @param {string} params.schema_id
     * @param {string} params.restflow_id
     * @param {boolean} params.is_active
     * @param {Date} params.created_at
     * @param {string} params.created_by
     * @param {Date} params.updated_at
     * @param {string} params.updated_by
     * @param {Date|null} params.deleted_at
     * @param {string|null} params.deleted_by
     */
    constructor({
        id,
        name,
        tablename,
        logs_tablename,
        schema_id,
        restflow_id,
        is_active,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at = null,
        deleted_by = null,
    }) {
        super(id);
        this.#name = new VOName(name);
        this.#tablename = new VOTableName(tablename);
        this.#logs_tablename = new VOLogsTableName(logs_tablename);
        this.#schema_id = new ValueObjectUuid('schema_id', schema_id);
        this.#restflow_id = new ValueObjectUuid('restflow_id', restflow_id, true);
        this.#is_active = new ValueObjectBoolean('is_active', is_active);
        this.created_at = created_at;
        this.created_by = created_by;
        this.updated_at = updated_at;
        this.updated_by = updated_by;
        this.deleted_at = deleted_at;
        this.deleted_by = deleted_by;
    }

    static create(dto) {
        return new AuxDefinition(dto);
    }

    /**
     * Gets the value of the `tablename` attribute.
     * @returns {VOTableName} The `VOTableName` instance representing the `tablename`.
     */
    get tablename() {
        return this.#tablename;
    }

    /**
     * Sets the value of the `tablename` attribute.
     * @param {string} value - The new value for the `tablename`.
     */
    set tablename(value) {
        this.#tablename = new VOTableName(value);
        this.changedAttributes.tablename = value;
    }

    /**
     * Gets the value of the `schema_id` attribute.
     * @returns {ValueObjectUuid} The `ValueObjectUuid` instance representing the `schema_id`.
     */
    get schema_id() {
        return this.#schema_id;
    }

    /**
     * Sets the value of the `schema_id` attribute.
     * @param {string} value - The new value for the `schema_id`.
     */
    set schema_id(value) {
        this.#schema_id = new ValueObjectUuid('schema_id', value);
        this.changedAttributes.schema_id = value;
    }

    /**
     * Gets the value of the `restflow_id` attribute.
     * @returns {ValueObjectUuid} The `ValueObjectUuid` instance representing the `restflow_id`.
     */
    get restflow_id() {
        return this.#restflow_id;
    }

    /**
     * Sets the value of the `restflow_id` attribute.
     * @param {string} value - The new value for the `restflow_id`.
     */
    set restflow_id(value) {
        this.#restflow_id = new ValueObjectUuid('restflow_id', value);
        this.changedAttributes.restflow_id = value;
    }

    /**
     * Gets the value of the `is_active` attribute.
     * @returns {ValueObjectBoolean} The `ValueObjectBoolean` instance representing the `is_active`.
     */
    get is_active() {
        return this.#is_active;
    }

    /**
     * Sets the value of the `is_active` attribute.
     * @param {boolean} value - The new value for the `is_active`.
     */
    set is_active(value) {
        this.#is_active = new ValueObjectBoolean('is_active', value);
        this.changedAttributes.is_active = value;
    }

    get name() {
        return this.#name;
    }

    set name(value) {
        if (this.#name.value !== value) {
            this.#name = new VOName(value);
            this.changedAttributes.name = value;
        }
    }

    get logs_tablename() {
        return this.#logs_tablename;
    }

    set logs_tablename(value) {
        if (this.#logs_tablename.value !== value) {
            this.#logs_tablename = new VOLogsTableName(value);
            this.changedAttributes.logs_tablename = value;
        }
    }
}
