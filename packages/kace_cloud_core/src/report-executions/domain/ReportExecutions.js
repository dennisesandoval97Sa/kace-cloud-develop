import {
    AggregateRoot,
    ValueObjectString,
    ValueObjectUuid,
    ValueObjectJson,
    ValueObjectTimestamp,
} from '../../shared/index.js';

export class ReportExecution extends AggregateRoot {
    /** @type {ValueObjectString} */
    #name;
    /** @type {ValueObjectUuid} */
    #issued_by;
    /** @type {ValueObjectJson} */
    #period;
    /** @type {ValueObjectJson} */
    #conditions;
    /** @type {ValueObjectString} */
    #s3_file;
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
        name,
        issued_by,
        period,
        conditions,
        s3_file,
        status = 'pending',
        result,
        error,
        started_at,
        completed_at,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);

        this.#name = new ValueObjectString('name', name, false);
        this.#issued_by = new ValueObjectUuid('issued_by', issued_by ?? null, true);
        this.#period = new ValueObjectJson('period', period ?? {});
        this.#conditions = new ValueObjectJson('conditions', conditions ?? null, true);
        this.#s3_file = new ValueObjectString('s3_file', s3_file ?? null, true);

        this.#status = new ValueObjectString('status', status, true);
        this.#result = new ValueObjectJson('result', result, true);
        this.#error = new ValueObjectJson('error', error, true);
        this.#started_at = new ValueObjectTimestamp('started_at', started_at, true);
        this.#completed_at = new ValueObjectTimestamp('completed_at', completed_at, true);

        if (created_by) this.created_by = created_by;
        if (updated_by) this.updated_by = updated_by;
        if (deleted_by) this.deleted_by = deleted_by;
        if (created_at) this.created_at = created_at;
        if (updated_at) this.updated_at = updated_at;
        if (deleted_at) this.deleted_at = deleted_at;
    }

    get name() {
        return this.#name;
    }

    set name(value) {
        if (this.#name.value !== value) {
            this.#name = new ValueObjectString('name', value, false);
            this.changedAttributes.name = value;
        }
    }

    get issued_by() {
        return this.#issued_by;
    }

    set issued_by(value) {
        if ((this.#issued_by?.value ?? null) !== value) {
            this.#issued_by = new ValueObjectUuid('issued_by', value);
            this.changedAttributes.issued_by = value;
        }
    }

    get period() {
        return this.#period;
    }

    set period(value) {
        if (JSON.stringify(this.#period.value) !== JSON.stringify(value)) {
            this.#period = new ValueObjectJson('period', value ?? {});
            this.changedAttributes.period = value;
        }
    }

    get conditions() {
        return this.#conditions;
    }

    set conditions(value) {
        if (JSON.stringify(this.#conditions?.value ?? null) !== JSON.stringify(value ?? null)) {
            this.#conditions = new ValueObjectJson('conditions', value ?? null, true);
            this.changedAttributes.conditions = value;
        }
    }

    get s3_file() {
        return this.#s3_file;
    }

    set s3_file(value) {
        if ((this.#s3_file?.value ?? null) !== value) {
            this.#s3_file = new ValueObjectString('s3_file', value ?? null, true);
            this.changedAttributes.s3_file = value;
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
        if (this.#result.value !== value) {
            this.#result = new ValueObjectJson('result', value, true);
            this.changedAttributes.result = JSON.stringify(value);
        }
    }

    get error() {
        return this.#error;
    }

    set error(value) {
        if (this.#error.value !== value) {
            this.#error = new ValueObjectJson('error', value, true);
            this.changedAttributes.error = JSON.stringify(value);
        }
    }

    get started_at() {
        return this.#started_at;
    }

    set started_at(value) {
        if (this.#started_at.value !== value) {
            this.#started_at = new ValueObjectTimestamp('started_at', value, true);
            this.changedAttributes.started_at = this.#started_at.value;
        }
    }

    get completed_at() {
        return this.#completed_at;
    }

    set completed_at(value) {
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

    /**
     * Create a new ReportExecution from a DTO
     * @param {Object} dto
     * @returns {ReportExecution}
     */
    static create(dto) {
        return new ReportExecution(dto);
    }
}

export default ReportExecution;
