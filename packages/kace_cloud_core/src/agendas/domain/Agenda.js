import { AggregateRoot } from '../../shared/index.js';
import {
    ValueObjectDailyLimit,
    ValueObjectDescription,
    ValueObjectIsActive,
    ValueObjectIsForWeekend,
    ValueObjectOneScriptId,
} from './value-objects/index.js';

export class Agenda extends AggregateRoot {
    /**
     * @type {ValueObjectDescription} is initialized in the constructor
     */
    #description;

    /**
     * @type {ValueObjectIsActive} is initialized in the constructor
     */
    #is_active;

    /**
     * @type {ValueObjectOneScriptId} is initialized in the constructor
     */
    #one_script_id;

    /**
     * @type {ValueObjectDailyLimit} is initialized in the constructor
     */
    #daily_limit;

    /**
     * @type {ValueObjectIsForWeekend} is initialized in the constructor
     */
    #is_for_weekend;

    constructor({
        id,
        description,
        is_active,
        one_script_id,
        daily_limit,
        is_for_weekend,
        created_by,
        updated_by,
        deleted_by,
        created_at,
        updated_at,
        deleted_at,
    }) {
        super(id);
        this.#description = new ValueObjectDescription('description', description ?? 'default');
        this.#is_active = new ValueObjectIsActive('is_active', is_active ?? false);
        this.#one_script_id = new ValueObjectOneScriptId('one_script_id', one_script_id, true);
        this.#daily_limit = new ValueObjectDailyLimit('daily_limit', daily_limit ?? 1);
        this.#is_for_weekend = new ValueObjectIsForWeekend('is_for_weekend', is_for_weekend ?? false);
        this.created_at = created_at;
        this.updated_at = updated_at;
        this.deleted_at = deleted_at;
        this.created_by = created_by;
        this.updated_by = updated_by;
        this.deleted_by = deleted_by;
    }

    /**
     * Create a new instance of Agenda and return it
     *
     * @param {Object} dto
     * @return {Agenda}
     */
    static create(dto) {
        return new Agenda(dto);
    }

    /**
     * @param {string} value
     */
    set description(value) {
        if (!this.#areEqual(this.#description.value, value)) {
            this.#description = new ValueObjectDescription('description', value);
            this.changedAttributes.description = this.#description.value;
        }
    }

    /**
     * @param {boolean} value
     */
    set is_active(value) {
        if (!this.#areEqual(this.#is_active.value, value)) {
            this.#is_active = new ValueObjectIsActive('is_active', value);
            this.changedAttributes.is_active = this.#is_active.value;
        }
    }

    /**
     * @param {string} value
     */
    set one_script_id(value) {
        if (!this.#areEqual(this.#one_script_id.value, value)) {
            this.#one_script_id = new ValueObjectOneScriptId('one_script_id', value);
            this.changedAttributes.one_script_id = this.#one_script_id.value;
        }
    }

    /**
     * @param {number} value
     */
    set daily_limit(value) {
        if (!this.#areEqual(this.#daily_limit.value, value)) {
            this.#daily_limit = new ValueObjectDailyLimit('daily_limit', value);
            this.changedAttributes.daily_limit = this.#daily_limit.value;
        }
    }

    /**
     * @param {boolean} value
     * @return {void}
     */
    set is_for_weekend(value) {
        if (!this.#areEqual(this.#is_for_weekend.value, value)) {
            this.#is_for_weekend = new ValueObjectIsForWeekend('is_for_weekend', value);
            this.changedAttributes.is_for_weekend = this.#is_for_weekend.value;
        }
    }

    /**
     * @return {ValueObjectDescription}
     */
    get description() {
        return this.#description;
    }

    /**
     * @return {ValueObjectIsActive}
     */
    get is_active() {
        return this.#is_active;
    }

    /**
     * @return {ValueObjectOneScriptId}
     */
    get one_script_id() {
        return this.#one_script_id;
    }

    /**
     * @return {ValueObjectDailyLimit}
     */
    get daily_limit() {
        return this.#daily_limit;
    }

    /**
     * @return {ValueObjectIsForWeekend}
     */
    get is_for_weekend() {
        return this.#is_for_weekend;
    }

    /**
     * Verify if two values are equal and return a boolean
     *
     * @return {boolean}
     */
    #areEqual(value, otherValue) {
        return value === otherValue;
    }
}
