import { ValueObjectURL } from '../../s3-files/domain/value-objects/index.js';
import { ValueObjectName } from './ValueObjectName.js';
import { AggregateRoot, ValueObjectUuid } from '../../shared/index.js';
import { ValueObjectUrlApi } from '../../s3-files/domain/value-objects/ValueObjectUrlApi.js';

export class OneScript extends AggregateRoot {
    /** @type {ValueObjectURL} is initialized in the constructor */
    #url;
    /** @type {ValueObjectName} is initialized in the constructor */
    #name;
    /** @type {ValueObjectUrlApi} is initialized in the constructor */
    #url_api;
    /** @type {ValueObjectUuid} */
    #schema_id;
    /** @type {ValueObjectUuid} */
    #onescript_reference_id;

    constructor({
        id,
        url,
        name,
        created_at,
        updated_at,
        deleted_at,
        created_by,
        updated_by,
        deleted_by,
        url_api,
        schema_id,
        onescript_reference_id,
    } = {}) {
        super(id);
        this.#url = new ValueObjectURL(url ?? 'default');
        this.#url_api = new ValueObjectUrlApi(url_api ?? 'default');
        this.#name = new ValueObjectName('name', name ?? 'default');
        this.#schema_id = new ValueObjectUuid('schema_id', schema_id, true);
        this.#onescript_reference_id = new ValueObjectUuid('onescript_reference_id', onescript_reference_id, true);
        this.created_at = created_at;
        this.updated_at = updated_at;
        this.deleted_at = deleted_at;
        this.created_by = created_by;
        this.updated_by = updated_by;
        this.deleted_by = deleted_by;
    }

    static create(dto) {
        return new OneScript(dto);
    }

    get url() {
        return this.#url;
    }

    set url(value) {
        if (value !== this.#url.value) {
            this.#url = new ValueObjectURL(value);
            this.changedAttributes.url = this.#url.value;
        }
    }

    get name() {
        return this.#name;
    }

    set name(value) {
        if (value !== this.#name.value) {
            this.#name = new ValueObjectName('name', value);
            this.changedAttributes.name = this.#name.value;
        }
    }

    get url_api() {
        return this.#url_api;
    }

    set url_api(value) {
        if (value !== this.#url_api.value) {
            this.#url_api = new ValueObjectUrlApi(value);
            this.changedAttributes.url_api = value;
        }
    }
    get schema_id() {
        return this.#schema_id;
    }

    set schema_id(value) {
        const newUuid = new ValueObjectUuid('schema_id', value, true);
        if (this.#schema_id.value !== newUuid.value) {
            this.#schema_id = newUuid;
            this.changedAttributes.schema_id = newUuid.value;
        }
    }

    get onescript_reference_id() {
        return this.#onescript_reference_id;
    }

    set onescript_reference_id(value) {
        const newUuid = new ValueObjectUuid('onescript_reference_id', value, true);
        if (this.#onescript_reference_id.value !== newUuid.value) {
            this.#onescript_reference_id = newUuid;
            this.changedAttributes.onescript_reference_id = newUuid.value;
        }
    }
}
