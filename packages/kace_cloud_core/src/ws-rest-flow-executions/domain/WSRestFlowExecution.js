import {
    AggregateRoot,
    ValueObjectJson,
    ValueObjectString,
    ValueObjectTimestamp,
    ValueObjectUuid,
} from '../../shared/index.js';

export class WSRestFlowExecution extends AggregateRoot {
    /** @type {ValueObjectUuid} */
    #flow_id;
    /** @type {ValueObjectString} */
    #external_code;
    /** @type {ValueObjectJson} */
    #initial_context;
    /** @type {ValueObjectString} */
    #status;
    /** @type {ValueObjectJson} */
    #result;
    /** @type {ValueObjectJson} */
    #error;
    /** @type {ValueObjectTimestamp} */
    #started_at;
    /** @type {ValueObjectTimestamp} */
    #completed_at;

    constructor({
        id,
        flow_id,
        external_code,
        initial_context,
        status = 'pending',
        result,
        error,
        created_by,
        created_at,
        started_at,
        completed_at,
        updated_by,
        updated_at,
        deleted_by,
        deleted_at,
    }) {
        super(id);
        this.#flow_id = new ValueObjectUuid('flow_id', flow_id, true);
        this.#external_code = new ValueObjectString('external_code', external_code, true);
        this.#initial_context = new ValueObjectJson('initial_context', initial_context, true);
        this.#status = new ValueObjectString('status', status);
        this.#result = new ValueObjectJson('result', result, true);
        this.#error = new ValueObjectJson('error', error, true);
        this.#started_at = new ValueObjectTimestamp('started_at', started_at, true);
        this.#completed_at = new ValueObjectTimestamp('completed_at', completed_at, true);
        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
    }

    get flow_id() {
        return this.#flow_id;
    }

    set flow_id(value) {
        if (this.#flow_id.value !== value) {
            this.#flow_id = new ValueObjectUuid('flow_id', value, true);
            this.changedAttributes.flow_id = value;
        }
    }

    get external_code() {
        return this.#external_code;
    }

    set external_code(value) {
        if (this.#external_code.value !== value) {
            this.#external_code = new ValueObjectString('external_code', value, true);
            this.changedAttributes.external_code = value;
        }
    }

    get initial_context() {
        return this.#initial_context;
    }

    set initial_context(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#initial_context.value !== value) {
            this.#initial_context = new ValueObjectJson('initial_context', value, true);
            this.changedAttributes.initial_context = value;
        }
    }

    get status() {
        return this.#status;
    }

    set status(value) {
        if (this.#status.value !== value) {
            this.#status = new ValueObjectString('status', value);
            this.changedAttributes.status = value;
        }
    }

    get result() {
        return this.#result;
    }

    set result(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#result.value !== value) {
            this.#result = new ValueObjectJson('result', value, true);
            this.changedAttributes.result = JSON.stringify(value);
        }
    }

    get error() {
        return this.#error;
    }

    set error(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#error.value !== value) {
            this.#error = new ValueObjectJson('error', value, true);
            this.changedAttributes.error = JSON.stringify(value);
        }
    }

    get started_at() {
        return this.#started_at;
    }

    set started_at(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#started_at.value !== value) {
            this.#started_at = new ValueObjectTimestamp('started_at', value, true);
            this.changedAttributes.started_at = this.#started_at.value;
        }
    }

    get completed_at() {
        return this.#completed_at;
    }

    set completed_at(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#completed_at.value !== value) {
            this.#completed_at = new ValueObjectTimestamp('completed_at', value, true);
            this.changedAttributes.completed_at = this.#completed_at.value;
        }
    }

    markAsInProgress() {
        this.status = 'in_progress';
        this.started_at = new Date();
        return this;
    }

    markAsCompleted(resultData) {
        this.status = 'completed';
        this.result = resultData;
        this.completed_at = new Date();
        return this;
    }

    markAsFailed(errorData) {
        this.status = 'failed';
        this.error = errorData;
        this.completed_at = new Date();
        return this;
    }

    static create(dto) {
        return new WSRestFlowExecution(dto);
    }
}
