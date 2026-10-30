import { AggregateRoot } from '../../shared/domain/AggregateRoot.js';
import { ValueObjectBoolean } from '../../shared/domain/value-object/ValueObjectBoolean.js';
import { ValueObjectSchemaName } from './ValueObjectSchemaName.js';
import { VODataStructure } from './VODataStructure.js';

export class Schema extends AggregateRoot {
    /**
     * @type {ValueObjectSchemaName}
     * is initialized in the constructor
     */
    #name;

    /**
     * @type {ValueObjectBoolean}
     * is initialized in the constructor
     */
    #is_active;

    /**
     * @type {VODataStructure}
     * is initialized in the constructor
     */
    #data_structure;

    /**
     * @param {Object} params
     * @param {string} params.id
     * @param {string} params.name
     * @param {boolean} params.is_active
     * @param {object} params.data_structure
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
        is_active,
        data_structure,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at = null,
        deleted_by = null,
    }) {
        super(id);
        this.#name = new ValueObjectSchemaName(name);
        this.#is_active = new ValueObjectBoolean('is_active', is_active);
        this.#data_structure = new VODataStructure(data_structure);
        this.created_at = created_at;
        this.created_by = created_by;
        this.updated_at = updated_at;
        this.updated_by = updated_by;
        this.deleted_at = deleted_at;
        this.deleted_by = deleted_by;
    }

    static create(params) {
        return new Schema(params);
    }

    get name() {
        return this.#name;
    }
    set name(value) {
        this.#name = new ValueObjectSchemaName(value);
        this.changedAttributes.name = value;
    }

    get is_active() {
        return this.#is_active;
    }
    set is_active(value) {
        this.#is_active = new ValueObjectBoolean('is_active', value);
        this.changedAttributes.is_active = value;
    }

    get data_structure() {
        return this.#data_structure;
    }
    set data_structure(value) {
        this.#data_structure = new VODataStructure(value);
        this.changedAttributes.data_structure = JSON.stringify(value);
    }
}
