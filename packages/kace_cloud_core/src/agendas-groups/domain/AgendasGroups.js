import { ValueObjectAgendaId, ValueObjectGroupId } from './value-objects/index.js';

export class AgendasGroups {
    /**
     * @type {ValueObjectAgendaId} is initialized in the constructor
     */
    #agenda_id;

    /**
     * @type {ValueObjectGroupId} is initialized in the constructor
     */
    #group_id;

    /**
     * @type {Object<string, any>} is initialized in the constructor
     */
    #changedAttributes;

    constructor({ agenda_id, group_id }) {
        this.#agenda_id = new ValueObjectAgendaId('agenda_id', agenda_id);
        this.#group_id = new ValueObjectGroupId('group_id', group_id);
        this.#changedAttributes = {};
    }

    /**
     * Create a new instance of the class and return it.
     *
     * @param {Object} dto - The data transfer object.
     *
     * @return {AgendasGroups} - The new instance of the class.
     */
    static create(dto) {
        return new AgendasGroups(dto);
    }

    /**
     * @param {string} agenda_id
     */
    set agenda_id(agenda_id) {
        if (!this.#areEqual(this.#agenda_id.value, agenda_id)) {
            this.#agenda_id = new ValueObjectAgendaId('agenda_id', agenda_id);
            this.#changedAttributes.agenda_id = agenda_id;
        }
    }

    /**
     * @param {string} group_id
     */
    set group_id(group_id) {
        if (!this.#areEqual(this.#group_id.value, group_id)) {
            this.#group_id = new ValueObjectGroupId('group_id', group_id);
            this.#changedAttributes.group_id = group_id;
        }
    }

    /**
     * @return {ValueObjectAgendaId}
     */
    get agenda_id() {
        return this.#agenda_id;
    }

    /**
     * @return {ValueObjectGroupId}
     */
    get group_id() {
        return this.#group_id;
    }

    /**
     * Verify if two values are equal.
     *
     * @return {boolean}
     */
    #areEqual(value, otherValue) {
        return value === otherValue;
    }
}
