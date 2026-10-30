import { AggregateRoot, ValueObjectBoolean, ValueObjectDescription, ValueObjectTimestamp } from '../../shared/index.js';
import { ValueObjectDetails } from './value-objects/ValueObjectDetails.js';
import { ValueObjectFrequency } from './value-objects/ValueObjectFrequency.js';
import { ValueObjectInterval } from './value-objects/ValueObjectInterval.js';
import { ValueObjectStoragePath } from './value-objects/ValueObjectStoragePath.js';
import { ValueObjectTimeFilter } from './value-objects/ValueObjectTimeFilter.js';
import { ValueObjectViews } from './value-objects/ValueObjectViews.js';

export class CsvExportView extends AggregateRoot {
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #description;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_active;
    /** @type {ValueObjectViews} is initialized in the constructor */
    #views;
    /** @type {ValueObjectFrequency} is initialized in the constructor */
    #frequency;
    /** @type {ValueObjectInterval} is initialized in the constructor */
    #interval;
    /** @type {ValueObjectTimeFilter} is initialized in the constructor */
    #time_filter;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #last_execution_at;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #next_execution_at;
    /** @type {ValueObjectDetails} is initialized in the constructor */
    #details;
    /** @type {ValueObjectStoragePath} is initialized in the constructor */
    #storage_path;

    constructor({
        id,
        description,
        is_active,
        views,
        frequency,
        interval,
        time_filter,
        storage_path,
        last_execution_at,
        next_execution_at,
        details,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#description = new ValueObjectDescription('description', description ?? 'default');
        this.#is_active = new ValueObjectBoolean('is_active', is_active ?? false);
        this.#views = new ValueObjectViews('views', views ?? ['default']);
        this.#frequency = new ValueObjectFrequency('frequency', frequency);
        this.#interval = new ValueObjectInterval('interval', interval ?? 1);
        this.#time_filter = new ValueObjectTimeFilter('time_filter', time_filter);
        this.#storage_path = new ValueObjectStoragePath('storage_path', storage_path, true);
        this.#last_execution_at = new ValueObjectTimestamp('last_execution_at', last_execution_at, true);
        this.#next_execution_at = new ValueObjectTimestamp('next_execution_at', next_execution_at ?? new Date());
        this.#details = new ValueObjectDetails('details', details, true);
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

    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        if (this.#is_active.value !== value) {
            this.#is_active = new ValueObjectBoolean('is_active', value);
            this.changedAttributes.is_active = value;
        }
    }

    get views() {
        return this.#views;
    }

    set views(value) {
        if (this.#views.value !== value) {
            this.#views = new ValueObjectViews('views', value);
            this.changedAttributes.views = JSON.stringify(value);
        }
    }

    get frequency() {
        return this.#frequency;
    }

    set frequency(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#frequency.value !== value) {
            this.#frequency = new ValueObjectFrequency('frequency', value);
            this.changedAttributes.frequency = value;
        }
    }

    get interval() {
        return this.#interval;
    }

    set interval(value) {
        if (this.#interval.value !== value) {
            this.#interval = new ValueObjectInterval('interval', value);
            this.changedAttributes.interval = value;
        }
    }

    get time_filter() {
        return this.#time_filter;
    }

    set time_filter(value) {
        if (this.#time_filter.value !== value) {
            this.#time_filter = new ValueObjectTimeFilter('time_filter', value);
            this.changedAttributes.time_filter = value;
        }
    }

    get last_execution_at() {
        return this.#last_execution_at;
    }

    set last_execution_at(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#last_execution_at.value !== value) {
            this.#last_execution_at = new ValueObjectTimestamp('last_execution_at', value);
            this.changedAttributes.last_execution_at = value;
        }
    }

    get details() {
        return this.#details;
    }

    set details(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#details.value !== value) {
            this.#details = new ValueObjectDetails('details', value);
            this.changedAttributes.details = value;
        }
    }

    get next_execution_at() {
        return this.#next_execution_at;
    }

    set next_execution_at(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#next_execution_at.value !== value) {
            this.#next_execution_at = new ValueObjectTimestamp('next_execution_at', value);
            this.changedAttributes.next_execution_at = value;
        }
    }

    get storage_path() {
        return this.#storage_path;
    }

    set storage_path(value) {
        if (this.#storage_path.value !== value) {
            this.#storage_path = new ValueObjectStoragePath('storage_path', value);
            this.changedAttributes.storage_path = value;
        }
    }

    /**
     * Returns the active status of the CsvExportView.
     * @returns {boolean} true if active, false if not active.
     */
    isActive() {
        return Boolean(this.#is_active.value);
    }

    /**
     * Creates a new instance of CsvExportView from a DTO object.
     *
     * @param {Object} dto - The DTO object that contains the properties for the CsvExportView object.
     * @returns {CsvExportView} A new instance of the CsvExportView class.
     */
    static create(dto) {
        return new CsvExportView(dto);
    }
}
