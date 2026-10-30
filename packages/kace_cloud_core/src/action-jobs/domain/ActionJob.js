import {
    AggregateRoot,
    ValueObjectBoolean,
    ValueObjectInt,
    ValueObjectJson,
    ValueObjectString,
    ValueObjectTimestamp,
    ValueObjectUuid,
    ValidationFailError,
} from '../../shared/index.js';
import { ValueObjectS3Key } from './ValueObjectS3Key.js';

export class ActionJob extends AggregateRoot {
    /** @type {ValueObjectString} is initialized in the constructor */
    #type;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_pending;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_in_progress;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_completed;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #action_id;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #search_filter;
    /** @type {ValueObjectS3Key} is initialized in the constructor */
    #s3_file_key;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #total_records;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #processed_records;
    /** @type {ValueObjectInt} is initialized in the constructor */
    #failed_records;
    /** @type {ValueObjectJsonb} is initialized in the constructor */
    #details;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #notifications_sent;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #start_at;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #end_at;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #restflow_id;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #restflow_context;

    constructor({
        id,
        type,
        is_pending = true,
        is_in_progress = false,
        is_completed = false,
        action_id,
        search_filter,
        s3_file_key,
        total_records,
        processed_records = 0,
        failed_records = 0,
        details,
        notifications_sent,
        start_at,
        end_at,
        created_at,
        created_by,
        updated_by,
        updated_at,
        deleted_by,
        deleted_at,
        restflow_id,
        restflow_context,
    }) {
        super(id);
        this.#type = new ValueObjectString('type', type ?? 'default');
        this.#is_pending = new ValueObjectBoolean('is_pending', is_pending, true);
        this.#is_in_progress = new ValueObjectBoolean('is_in_progress', is_in_progress, true);
        this.#is_completed = new ValueObjectBoolean('is_completed', is_completed, true);
        this.#action_id = new ValueObjectUuid('action_id', action_id, true);
        this.#search_filter = new ValueObjectJson('search_filter', search_filter, true);
        this.#s3_file_key = new ValueObjectString('s3_file_key', s3_file_key, true);
        this.#total_records = new ValueObjectInt('total_records', total_records, true);
        this.#processed_records = new ValueObjectInt('processed_records', processed_records, true);
        this.#failed_records = new ValueObjectInt('failed_records', failed_records, true);
        this.#details = new ValueObjectJson('details', details, true);
        this.#notifications_sent = new ValueObjectBoolean('notifications_sent', notifications_sent, true);
        this.#start_at = new ValueObjectTimestamp('start_at', start_at, true);
        this.#end_at = new ValueObjectTimestamp('end_at', end_at, true);
        this.#restflow_id = new ValueObjectUuid('restflow_id', restflow_id, true);
        this.#restflow_context = new ValueObjectJson('restflow_context', restflow_context, true);
        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
        this.#validateExclusiveIds();
    }

    get type() {
        return this.#type;
    }

    set type(value) {
        if (this.#type.value !== value) {
            this.#type = new ValueObjectString('type', value);
            this.changedAttributes.type = value;
        }
    }

    get is_pending() {
        return this.#is_pending;
    }

    set is_pending(value) {
        if (this.#is_pending.value !== value) {
            this.#is_pending = new ValueObjectBoolean('is_pending', value);
            this.changedAttributes.is_pending = value;
        }
    }

    get is_in_progress() {
        return this.#is_in_progress;
    }

    set is_in_progress(value) {
        if (this.#is_in_progress.value !== value) {
            this.#is_in_progress = new ValueObjectBoolean('is_in_progress', value);
            this.changedAttributes.is_in_progress = value;
        }
    }

    get is_completed() {
        return this.#is_completed;
    }

    set is_completed(value) {
        if (this.#is_completed.value !== value) {
            this.#is_completed = new ValueObjectBoolean('is_completed', value);
            this.changedAttributes.is_completed = value;
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

    get search_filter() {
        return this.#search_filter;
    }

    set search_filter(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#search_filter.value !== value) {
            this.#search_filter = new ValueObjectJson('search_filter', value);
            this.changedAttributes.search_filter = value;
        }
    }

    get s3_file_key() {
        return this.#s3_file_key;
    }

    set s3_file_key(value) {
        if (this.#s3_file_key.value !== value) {
            this.#s3_file_key = new ValueObjectS3Key('s3_file_key', value);
            this.changedAttributes.s3_file_key = value;
        }
    }

    get total_records() {
        return this.#total_records;
    }

    set total_records(value) {
        if (this.#total_records.value !== value) {
            this.#total_records = new ValueObjectInt('total_records', value);
            this.changedAttributes.total_records = value;
        }
    }

    get processed_records() {
        return this.#processed_records;
    }

    set processed_records(value) {
        if (this.#processed_records.value !== value) {
            this.#processed_records = new ValueObjectInt('processed_records', value);
            this.changedAttributes.processed_records = value;
        }
    }

    get failed_records() {
        return this.#failed_records;
    }

    set failed_records(value) {
        if (this.#failed_records.value !== value) {
            this.#failed_records = new ValueObjectInt('failed_records', value);
            this.changedAttributes.failed_records = value;
        }
    }

    get details() {
        return this.#details;
    }

    set details(value) {
        if (this.#details.value !== value) {
            this.#details = new ValueObjectJson('details', value);
            this.changedAttributes.details = JSON.stringify(value);
        }
    }

    get notifications_sent() {
        return this.#notifications_sent;
    }

    set notifications_sent(value) {
        if (this.#notifications_sent.value !== value) {
            this.#notifications_sent = new ValueObjectBoolean('notifications_sent', value);
            this.changedAttributes.notifications_sent = value;
        }
    }

    get start_at() {
        return this.#start_at;
    }

    set start_at(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#start_at.value !== value) {
            this.#start_at = new ValueObjectTimestamp('start_at', value);
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

    get restflow_context() {
        return this.#restflow_context;
    }

    set restflow_context(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#restflow_context.value !== value) {
            this.#restflow_context = new ValueObjectJson('restflow_context', value);
            this.changedAttributes.restflow_context = value;
        }
    }

    markAsInProgress() {
        this.is_in_progress = true;
        this.is_pending = false;
        this.is_completed = false;
        this.start_at = new Date();
        return this;
    }

    markAsCompleted(result = null) {
        this.is_completed = true;
        this.is_in_progress = false;
        this.is_pending = false;
        this.end_at = new Date();
        this.details = { ...this.details.value, ...result };
        return this;
    }

    static create(dto) {
        return new ActionJob(dto);
    }

    #validateExclusiveIds() {
        const hasActionId = !!this.#action_id.value;
        const hasRestflowId = !!this.#restflow_id.value;
        const isFilterType = this.#type.value === 'filter' || this.#type.value === 'filter_clients';

        const idsCount = [hasActionId, hasRestflowId].filter(Boolean).length;

        if (idsCount > 1) {
            throw new ValidationFailError(
                'Only one of action_id or restflow_id is permitted',
                'action_id | restflow_id'
            );
        }

        if (isFilterType && idsCount === 0) {
            throw new ValidationFailError(
                'At least one of action_id or restflow_id must be provided',
                'action_id | restflow_id'
            );
        }
    }
}
