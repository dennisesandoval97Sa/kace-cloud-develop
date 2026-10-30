import { AggregateRoot, ValueObjectEnum, ValueObjectInt, ValueObjectTimestamp } from '../../shared/index.js';
import { RUN_STATUS } from './RunStatus.js';
import { ValueObjectRunDetail } from './value-objects/ValueObjectRunDetail.js';

export class AutomatedAssignmentRun extends AggregateRoot {
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #started_at;

    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #finished_at;

    /** @type {ValueObjectInt} is initialized in the constructor */
    #duration_ms;

    /** @type {ValueObjectEnum} is initialized in the constructor */
    #status;

    /** @type {ValueObjectInt} is initialized in the constructor */
    #actions_evaluated;

    /** @type {ValueObjectInt} is initialized in the constructor */
    #candidates_total;

    /** @type {ValueObjectInt} is initialized in the constructor (nullable) */
    #candidates_backlog_total;

    /** @type {ValueObjectInt} is initialized in the constructor */
    #assigned;

    /** @type {ValueObjectInt} is initialized in the constructor */
    #skipped;

    /** @type {ValueObjectInt} is initialized in the constructor */
    #errors;

    /** @type {ValueObjectInt} is initialized in the constructor */
    #groups_without_capacity;

    /** @type {ValueObjectRunDetail} is initialized in the constructor */
    #actions_detail;

    /** @type {ValueObjectRunDetail} is initialized in the constructor */
    #capacity_snapshot;

    /** @type {ValueObjectRunDetail} is initialized in the constructor */
    #error_detail;

    constructor(dto) {
        super(dto.id);
        this.#started_at = new ValueObjectTimestamp('started_at', dto.started_at);
        this.#finished_at = new ValueObjectTimestamp('finished_at', dto.finished_at, true);
        this.#duration_ms = new ValueObjectInt('duration_ms', dto.duration_ms, true);
        this.#status = new ValueObjectEnum('status', dto.status, Object.values(RUN_STATUS));
        this.#actions_evaluated = new ValueObjectInt('actions_evaluated', dto.actions_evaluated ?? 0);
        this.#candidates_total = new ValueObjectInt('candidates_total', dto.candidates_total ?? 0);
        this.#candidates_backlog_total = new ValueObjectInt(
            'candidates_backlog_total',
            dto.candidates_backlog_total,
            true
        );
        this.#assigned = new ValueObjectInt('assigned', dto.assigned ?? 0);
        this.#skipped = new ValueObjectInt('skipped', dto.skipped ?? 0);
        this.#errors = new ValueObjectInt('errors', dto.errors ?? 0);
        this.#groups_without_capacity = new ValueObjectInt('groups_without_capacity', dto.groups_without_capacity ?? 0);
        this.#actions_detail = new ValueObjectRunDetail('actions_detail', dto.actions_detail);
        this.#capacity_snapshot = new ValueObjectRunDetail('capacity_snapshot', dto.capacity_snapshot);
        this.#error_detail = new ValueObjectRunDetail('error_detail', dto.error_detail);
        // AggregateRoot#created_at requires a non-null value (not `nullable`), unlike deleted_at.
        // At creation time (before save()) created_at is DB-generated and absent from the DTO,
        // so only assign when present — otherwise the ValueObjectTimestamp constructor throws.
        if (dto.created_at) {
            this.created_at = dto.created_at;
        }
        this.deleted_at = dto.deleted_at;
    }

    get started_at() {
        return this.#started_at;
    }

    set started_at(value) {
        value = new ValueObjectTimestamp('started_at', value);
        this.#started_at = value;
        this.changedAttributes.started_at = this.#started_at.value;
    }

    get finished_at() {
        return this.#finished_at;
    }

    set finished_at(value) {
        value = new ValueObjectTimestamp('finished_at', value, true);
        this.#finished_at = value;
        this.changedAttributes.finished_at = this.#finished_at.value;
    }

    get duration_ms() {
        return this.#duration_ms;
    }

    set duration_ms(value) {
        value = new ValueObjectInt('duration_ms', value, true);
        this.#duration_ms = value;
        this.changedAttributes.duration_ms = this.#duration_ms.value;
    }

    get status() {
        return this.#status;
    }

    set status(value) {
        value = new ValueObjectEnum('status', value, Object.values(RUN_STATUS));
        this.#status = value;
        this.changedAttributes.status = this.#status.value;
    }

    get actions_evaluated() {
        return this.#actions_evaluated;
    }

    set actions_evaluated(value) {
        value = new ValueObjectInt('actions_evaluated', value);
        this.#actions_evaluated = value;
        this.changedAttributes.actions_evaluated = this.#actions_evaluated.value;
    }

    get candidates_total() {
        return this.#candidates_total;
    }

    set candidates_total(value) {
        value = new ValueObjectInt('candidates_total', value);
        this.#candidates_total = value;
        this.changedAttributes.candidates_total = this.#candidates_total.value;
    }

    get candidates_backlog_total() {
        return this.#candidates_backlog_total;
    }

    set candidates_backlog_total(value) {
        value = new ValueObjectInt('candidates_backlog_total', value, true);
        this.#candidates_backlog_total = value;
        this.changedAttributes.candidates_backlog_total = this.#candidates_backlog_total.value;
    }

    get assigned() {
        return this.#assigned;
    }

    set assigned(value) {
        value = new ValueObjectInt('assigned', value);
        this.#assigned = value;
        this.changedAttributes.assigned = this.#assigned.value;
    }

    get skipped() {
        return this.#skipped;
    }

    set skipped(value) {
        value = new ValueObjectInt('skipped', value);
        this.#skipped = value;
        this.changedAttributes.skipped = this.#skipped.value;
    }

    get errors() {
        return this.#errors;
    }

    set errors(value) {
        value = new ValueObjectInt('errors', value);
        this.#errors = value;
        this.changedAttributes.errors = this.#errors.value;
    }

    get groups_without_capacity() {
        return this.#groups_without_capacity;
    }

    set groups_without_capacity(value) {
        value = new ValueObjectInt('groups_without_capacity', value);
        this.#groups_without_capacity = value;
        this.changedAttributes.groups_without_capacity = this.#groups_without_capacity.value;
    }

    get actions_detail() {
        return this.#actions_detail;
    }

    set actions_detail(value) {
        value = new ValueObjectRunDetail('actions_detail', value);
        this.#actions_detail = value;
        this.changedAttributes.actions_detail = this.#actions_detail.value;
    }

    get capacity_snapshot() {
        return this.#capacity_snapshot;
    }

    set capacity_snapshot(value) {
        value = new ValueObjectRunDetail('capacity_snapshot', value);
        this.#capacity_snapshot = value;
        this.changedAttributes.capacity_snapshot = this.#capacity_snapshot.value;
    }

    get error_detail() {
        return this.#error_detail;
    }

    set error_detail(value) {
        value = new ValueObjectRunDetail('error_detail', value);
        this.#error_detail = value;
        this.changedAttributes.error_detail = this.#error_detail.value;
    }

    /**
     * Creates a new AutomatedAssignmentRun object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the run.
     * @returns {AutomatedAssignmentRun} A new instance of the AutomatedAssignmentRun class.
     */
    static create(dto) {
        return new AutomatedAssignmentRun(dto);
    }

    toJson() {
        return {
            id: this.id.value,
            started_at: this.#started_at.value,
            finished_at: this.#finished_at.value,
            duration_ms: this.#duration_ms.value,
            status: this.#status.value,
            actions_evaluated: this.#actions_evaluated.value,
            candidates_total: this.#candidates_total.value,
            candidates_backlog_total: this.#candidates_backlog_total.value,
            assigned: this.#assigned.value,
            skipped: this.#skipped.value,
            errors: this.#errors.value,
            groups_without_capacity: this.#groups_without_capacity.value,
            actions_detail: this.#actions_detail.value,
            capacity_snapshot: this.#capacity_snapshot.value,
            error_detail: this.#error_detail.value,
        };
    }
}
