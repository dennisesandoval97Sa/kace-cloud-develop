import { AggregateRoot } from '../../shared/domain/AggregateRoot.js';
import { ValueObjectCronExpression, ValueObjectDescription, ValueObjectTimestamp } from '../../shared/index.js';

export class AutomationSettings extends AggregateRoot {
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #description;
    /** @type {ValueObjectCronExpression} is initialized in the constructor */
    #frequency;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #start_date;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #end_date;

    constructor({
        id,
        description,
        frequency,
        start_date,
        end_date,
        created_at,
        updated_at,
        created_by,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#description = new ValueObjectDescription('description', description);
        this.#frequency = new ValueObjectCronExpression('frequency', frequency);
        this.#start_date = new ValueObjectTimestamp('Start date', start_date, true);
        this.#end_date = new ValueObjectTimestamp('End date', end_date, true);
        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
    }

    get description() {
        return this.#description;
    }

    set description(value) {
        if (this.#description.value !== value) {
            this.#description = new ValueObjectDescription('description', value);
            this.changedAttributes.description = value;
        }
    }

    get frequency() {
        return this.#frequency;
    }

    set frequency(value) {
        if (this.#frequency.value !== value) {
            this.#frequency = new ValueObjectCronExpression('frequency', value);
            this.changedAttributes.frequency = value;
        }
    }

    get start_date() {
        return this.#start_date;
    }

    set start_date(value) {
        const newValue = new ValueObjectTimestamp('Start date', value, true);
        if (this.#start_date.value !== newValue.value) {
            this.#start_date = newValue;
            this.changedAttributes.start_date = newValue.value;
        }
    }

    get end_date() {
        return this.#end_date;
    }

    set end_date(value) {
        const newValue = new ValueObjectTimestamp('End date', value, true);
        if (this.#end_date.value !== newValue.value) {
            this.#end_date = newValue;
            this.changedAttributes.end_date = newValue.value;
        }
    }

    /**
     * Creates a new AutomationSettings object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the AutomationSettings object.
     * @returns {AutomationSettings} A new instance of the AutomationSettings class.
     */
    static create(dto) {
        return new AutomationSettings(dto);
    }
}
