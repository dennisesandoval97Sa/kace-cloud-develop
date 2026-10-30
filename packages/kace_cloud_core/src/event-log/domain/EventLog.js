import { AggregateRoot, ValueObjectUuid, ValueObjectTimestamp, ValueObjectJson } from '../../shared';
import { ValueObjectEventName } from './ValueObjectEventName';

export class EventLog extends AggregateRoot {
    /** @type {ValueObjectEventName} is initialized in the constructor */
    #event_name;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #occurred_at;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #initiated_by_user;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #aggregate_id;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #body;
    /** @type {ValueObjectJson} is initialized in the constructor */
    #old_data;
    /** @type {ValueObjectUuid|null} is initialized in the constructor */
    #case_id;
    /** @type {ValueObjectUuid|null} is initialized in the constructor */
    #client_id;

    constructor(dto) {
        super(dto.id);

        this.#event_name = new ValueObjectEventName('event_name', dto.event_name);
        this.#occurred_at = new ValueObjectTimestamp('occurred_at', dto.occurred_at);
        this.#initiated_by_user = new ValueObjectUuid('initiated_by_user', dto.initiated_by_user);
        this.#aggregate_id = new ValueObjectUuid('aggregate_id', dto.aggregate_id);
        this.#body = new ValueObjectJson('body', dto.body);
        this.#old_data = new ValueObjectJson('old_data', dto.old_data, true);

        this.#case_id = new ValueObjectUuid('case_id', dto.case_id, true);
        this.#client_id = new ValueObjectUuid('client_id', dto.client_id, true);
    }

    get event_name() {
        return this.#event_name;
    }

    set event_name(value) {
        if (this.#event_name.value !== value) {
            this.#event_name = new ValueObjectEventName('event_name', value);
            this.changedAttributes.event_name = value;
        }
    }

    get occurred_at() {
        return this.#occurred_at;
    }

    set occurred_at(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#occurred_at.value !== value) {
            this.#occurred_at = new ValueObjectTimestamp('occurred_at', value);
            this.changedAttributes.occurred_at = value;
        }
    }

    get initiated_by_user() {
        return this.#initiated_by_user;
    }

    set initiated_by_user(value) {
        if (this.#initiated_by_user.value !== value) {
            this.#initiated_by_user = new ValueObjectUuid('initiated_by_user', value);
            this.changedAttributes.initiated_by_user = value;
        }
    }

    get aggregate_id() {
        return this.#aggregate_id;
    }

    set aggregate_id(value) {
        if (this.#aggregate_id.value !== value) {
            this.#aggregate_id = new ValueObjectUuid('aggregate_id', value);
            this.changedAttributes.aggregate_id = value;
        }
    }

    get body() {
        return this.#body;
    }

    set body(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#body.value !== value) {
            this.#body = new ValueObjectJson('body', value);
            this.changedAttributes.body = value;
        }
    }

    get old_data() {
        return this.#old_data;
    }

    set old_data(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#old_data.value !== value) {
            this.#old_data = new ValueObjectJson('old_data', value);
            this.changedAttributes.old_data = value;
        }
    }

    get case_id() {
        return this.#case_id;
    }

    set case_id(value) {
        if (this.#case_id.value !== value) {
            this.#case_id = new ValueObjectUuid('case_id', value, true);
            this.changedAttributes.case_id = value;
        }
    }

    get client_id() {
        return this.#client_id;
    }

    set client_id(value) {
        if (this.#client_id.value !== value) {
            this.#client_id = new ValueObjectUuid('client_id', value, true);
            this.changedAttributes.client_id = value;
        }
    }

    static create(dto) {
        return new EventLog(dto);
    }
}
