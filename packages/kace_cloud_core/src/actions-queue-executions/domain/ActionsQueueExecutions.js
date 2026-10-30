import { AggregateRoot, ValidationFailError } from '../../shared';
import { ValueObjectActionId } from './value-objects/ValueObjectActionId';
import { ValueObjectCaseId } from './value-objects/ValueObjectCaseId';
import { ValueObjectClientId } from './value-objects/ValueObjectClientId';
import { ValueObjectStatus } from './value-objects/ValueObjectStatus';
import { ValueObjectTriggerType } from './value-objects/ValueObjectTriggerType';
import { ValueObjectStartExecution } from './value-objects/ValueObjectStartExecution';
import { ValueObjectEndExecution } from './value-objects/ValueObjectEndExecution';

export class ActionsQueueExecutions extends AggregateRoot {
    /**
     * @type {ValueObjectActionId}
     */
    #action_id;

    /**
     * @type {ValueObjectCaseId}
     */
    #case_id;

    /**
     * @type {ValueObjectClientId}
     */
    #client_id;

    /**
     * @type {ValueObjectStatus}
     */
    #status;

    /**
     * @type {ValueObjectTriggerType}
     */
    #trigger_type;

    /**
     * @type {ValueObjectStartExecution}
     */
    #start_execution;

    /**
     * @type {ValueObjectEndExecution}
     */
    #end_execution;

    constructor({
        id,
        action_id,
        case_id,
        client_id,
        status,
        trigger_type,
        start_execution,
        end_execution,
        created_by,
        updated_by,
        deleted_by,
        created_at,
        updated_at,
        deleted_at,
    }) {
        super(id);

        this.#action_id = new ValueObjectActionId(action_id);
        this.#case_id = new ValueObjectCaseId(case_id);
        this.#client_id = new ValueObjectClientId(client_id);
        this.#status = new ValueObjectStatus(status);
        this.#trigger_type = new ValueObjectTriggerType(trigger_type);
        this.#start_execution = new ValueObjectStartExecution(start_execution);
        this.#end_execution = new ValueObjectEndExecution(end_execution);

        this.#validateExecutionDates();

        this.created_at = created_at;
        this.updated_at = updated_at;
        this.deleted_at = deleted_at;
        this.created_by = created_by;
        this.updated_by = updated_by;
        this.deleted_by = deleted_by;
    }

    static create(dto) {
        return new ActionsQueueExecutions(dto);
    }

    /**
     * @returns {ValueObjectActionId}
     */
    get action_id() {
        return this.#action_id;
    }

    /**
     * @returns {ValueObjectCaseId}
     */
    get case_id() {
        return this.#case_id;
    }

    /**
     * @returns {ValueObjectClientId}
     */
    get client_id() {
        return this.#client_id;
    }

    /**
     * @returns {ValueObjectStatus}
     */
    get status() {
        return this.#status;
    }

    /**
     * @returns {ValueObjectTriggerType}
     */
    get trigger_type() {
        return this.#trigger_type;
    }

    /**
     * @returns {ValueObjectStartExecution}
     */
    get start_execution() {
        return this.#start_execution;
    }

    /**
     * @returns {ValueObjectEndExecution}
     */
    get end_execution() {
        return this.#end_execution;
    }

    set action_id(value) {
        this.#action_id = this.#updateValueObject('action_id', this.#action_id, value, ValueObjectActionId);
    }

    set case_id(value) {
        this.#case_id = this.#updateValueObject('case_id', this.#case_id, value, ValueObjectCaseId);
    }

    set client_id(value) {
        this.#client_id = this.#updateValueObject('client_id', this.#client_id, value, ValueObjectClientId);
    }

    set status(value) {
        this.#status = this.#updateValueObject('status', this.#status, value, ValueObjectStatus);
    }

    set trigger_type(value) {
        this.#trigger_type = this.#updateValueObject('trigger_type', this.#trigger_type, value, ValueObjectTriggerType);
    }

    set start_execution(value) {
        const newStartExecution = this.#updateValueObject(
            'start_execution',
            this.#start_execution,
            value,
            ValueObjectStartExecution
        );

        this.#start_execution = newStartExecution;

        this.#validateExecutionDates();
    }

    set end_execution(value) {
        const newEndExecution = this.#updateValueObject(
            'end_execution',
            this.#end_execution,
            value,
            ValueObjectEndExecution
        );

        this.#end_execution = newEndExecution;

        this.#validateExecutionDates();
    }

    /**
     * Validates that the start date is not later than the end date
     * when both values ​​are defined
     *
     * @throws {Error} If the start date is after the end date
     * @private
     */
    #validateExecutionDates() {
        const startValue = this.#start_execution.value;
        const endValue = this.#end_execution.value;

        if (startValue && endValue) {
            const startDate = new Date(startValue);
            const endDate = new Date(endValue);

            if (startDate > endDate) {
                throw new ValidationFailError(
                    'Start date cannot be later than end date',
                    'start_execution and end_execution'
                );
            }
        }
    }

    /**
     * Helper method to update a value object and record the change
     *
     * @param {string} property - Property name
     * @param currentValueObject - Actual value object
     * @param newValue - New value
     * @param {Function} ValueObjectClass - Class of the value object
     *
     * @returns New value object or the current one if there are no changes
     * @private
     */
    #updateValueObject(property, currentValueObject, newValue, ValueObjectClass) {
        if (currentValueObject.value !== newValue) {
            const newValueObject = new ValueObjectClass(newValue);
            this.changedAttributes[property] = newValueObject.value;
            return newValueObject;
        }
        return currentValueObject;
    }
}
