import {
    AggregateRoot,
    ValueObjectBoolean,
    ValueObjectJson,
    ValueObjectTimestamp,
    ValueObjectUuid,
} from '../../shared/index.js';

export class ActionJobProcessing extends AggregateRoot {
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #job_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #action_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #case_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #client_id;
    /** @type {boolean} is initialized in the constructor */
    #is_in_progress;
    /** @type {boolean} is initialized in the constructor */
    #is_completed;
    /** @type {boolean} is initialized in the constructor */
    #is_failed;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #start_at;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #end_at;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #details;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #evaluate_conditions;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #restflow_id;

    constructor({
        id,
        job_id,
        action_id,
        case_id,
        client_id,
        is_in_progress = false,
        is_completed = false,
        is_failed = false,
        start_at,
        end_at,
        details,
        evaluate_conditions,
        created_by,
        created_at,
        updated_by,
        updated_at,
        deleted_by,
        deleted_at,
        restflow_id,
    }) {
        super(id);
        this.#job_id = new ValueObjectUuid('job_id', job_id, true);
        this.#action_id = new ValueObjectUuid('action_id', action_id, true);
        this.#restflow_id = new ValueObjectUuid('restflow_id', restflow_id, true);
        this.#case_id = new ValueObjectUuid('case_id', case_id, true);
        this.#client_id = new ValueObjectUuid('client_id', client_id, true);
        this.#is_in_progress = new ValueObjectBoolean('is_in_progress', is_in_progress);
        this.#is_completed = new ValueObjectBoolean('is_completed', is_completed);
        this.#is_failed = new ValueObjectBoolean('is_failed', is_failed);
        this.#start_at = new ValueObjectTimestamp('start_at', start_at, true);
        this.#end_at = new ValueObjectTimestamp('end_at', end_at, true);
        this.#details = new ValueObjectJson('details', details, true);
        this.#evaluate_conditions = new ValueObjectBoolean('evaluate_conditions', evaluate_conditions, true);
        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
    }

    get job_id() {
        return this.#job_id;
    }

    set job_id(value) {
        if (this.#job_id.value !== value) {
            this.#job_id = new ValueObjectUuid('job_id', value);
            this.changedAttributes.job_id = value;
        }
    }

    get action_id() {
        return this.#action_id;
    }

    set action_id(value) {
        if (this.#action_id.value !== value) {
            this.#action_id = new ValueObjectUuid('action_id', value);
            this.changedAttributes.action_id = value;
        }
    }

    get case_id() {
        return this.#case_id;
    }

    set case_id(value) {
        if (this.#case_id.value !== value) {
            this.#case_id = new ValueObjectUuid('case_id', value);
            this.changedAttributes.case_id = value;
        }
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

    get is_in_progress() {
        return this.#is_in_progress;
    }

    set is_in_progress(value) {
        if (this.#is_in_progress !== value) {
            this.#is_in_progress = new ValueObjectBoolean('is_in_progress', value);
            this.changedAttributes.is_in_progress = value;
        }
    }

    get is_completed() {
        return this.#is_completed;
    }

    set is_completed(value) {
        if (this.#is_completed !== value) {
            this.#is_completed = new ValueObjectBoolean('is_completed', value);
            this.changedAttributes.is_completed = value;
        }
    }

    get is_failed() {
        return this.#is_failed;
    }

    set is_failed(value) {
        if (this.#is_failed !== value) {
            this.#is_failed = new ValueObjectBoolean('is_failed', value);
            this.changedAttributes.is_failed = value;
        }
    }

    get start_at() {
        return this.#start_at;
    }

    set start_at(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#start_at.value !== value) {
            this.#start_at = new ValueObjectTimestamp('start_at', value, true);
            this.changedAttributes.start_at = this.start_at.value;
        }
    }

    get end_at() {
        return this.#end_at;
    }

    set end_at(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#end_at.value !== value) {
            this.#end_at = new ValueObjectTimestamp('end_at', value, true);
            this.changedAttributes.end_at = this.end_at.value;
        }
    }

    get details() {
        return this.#details;
    }

    set details(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#details.value !== value) {
            this.#details = new ValueObjectJson('details', value, true);
            this.changedAttributes.details = JSON.stringify(value);
        }
    }

    get evaluate_conditions() {
        return this.#evaluate_conditions;
    }

    set evaluate_conditions(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#evaluate_conditions.value !== value) {
            this.#evaluate_conditions = new ValueObjectBoolean('evaluate_conditions', value, true);
            this.changedAttributes.evaluate_conditions = value;
        }
    }

    get restflow_id() {
        return this.#restflow_id;
    }

    set restflow_id(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#restflow_id.value !== value) {
            this.#restflow_id = new ValueObjectUuid('restflow_id', value);
            this.changedAttributes.restflow_id = value;
        }
    }

    markAsInProgress() {
        this.is_in_progress = true;
        this.is_completed = false;
        this.is_failed = false;
        this.start_at = new Date();
        return this;
    }

    markAsCompleted() {
        this.is_in_progress = false;
        this.is_completed = true;
        this.is_failed = false;
        this.end_at = new Date();
        return this;
    }

    markAsFailed(errors) {
        this.is_in_progress = false;
        this.is_completed = false;
        this.is_failed = true;
        this.end_at = new Date();
        this.#updateDetailsErrors(errors);
        return this;
    }

    markForRetry(errors) {
        this.is_in_progress = false;
        this.is_completed = false;
        this.is_failed = false;
        this.#updateDetailsErrors(errors);
        return this;
    }

    incrementAttempt() {
        const attempts = this.details.value.attempts || 0;
        this.#details.value.attempts = attempts + 1;
        this.changedAttributes.details = JSON.stringify(this.#details.value);
        return this;
    }

    #updateDetailsErrors(errors = []) {
        const currentErrors = this.#details.value.errors || [];
        this.#details.value.errors = [...currentErrors, ...errors];
        this.changedAttributes.details = JSON.stringify(this.#details.value);
    }

    static create(dto) {
        return new ActionJobProcessing(dto);
    }
}
