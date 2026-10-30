import { AggregateRoot } from '../../shared/domain/AggregateRoot.js';
import { ValueObjectDescription } from './value-objects/ValueObjectDescription.js';

import { ValueObjectHttpMethod } from './value-objects/ValueObjectHttpMethod.js';
import { ValueObjectHttpRequestType } from './value-objects/ValueObjectHttpRequestType.js';
import { ValueObjectURL } from './value-objects/ValueObjectURL.js';
import { ValueObjectActive } from './value-objects/ValueObjectActive.js';
import { ValueObjectDynamicBody } from './value-objects/ValueObjectDynamicBody.js';
import { ValueObjectBody } from './value-objects/ValueObjectBody.js';
import { ValueObjectHeaders } from './value-objects/ValueObjectHeaders.js';
import { ValueObjectAuthorization } from './value-objects/ValueObjectAuthorization.js';
import { ValueObjectDynamicHeader } from './value-objects/ValueObjectDynamicHeader.js';
import { ValueObjectFilterInput } from './value-objects/ValueObjectFilterInput.js';
import { ValueObjectContextPosition } from './value-objects/ValueObjectContextPosition.js';
import { ValueObjectSuccess } from './value-objects/ValueObjectSuccess.js';
import { ValueObjectError } from './value-objects/ValueObjectError.js';
import { ValueObjectAttempts } from './value-objects/ValueObjectAttempts.js';
import { ValueObjectInitialContext } from './value-objects/ValueObjectInitialContext.js';
import { ValueObjectBodyType } from './value-objects/ValueObjectBodyType.js';
import { ValueObjectCacheExpiresInPath } from './value-objects/ValueObjectCacheExpiresInPath.js';
import { ValueObjectCacheDefaultTtlSeconds } from './value-objects/ValueObjectCacheDefaultTtlSeconds.js';

export class WSRestEndpoint extends AggregateRoot {
    /** @type {ValueObjectHttpRequestType} is initialized in the constructor */
    #type;
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #description;
    /** @type {ValueObjectURL} is initialized in the constructor */
    #url;
    /** @type {ValueObjectMethod} is initialized in the constructor */
    #method;
    /** @type {ValueObjectHeaders} is initialized in the constructor */
    #headers;
    /** @type {ValueObjectBody} is initialized in the constructor */
    #body;
    /** @type {ValueObjectDynamicBody} is initialized in the constructor */
    #is_dynamic_body;
    /** @type {ValueObjectActive} is initialized in the constructor */
    #is_active;
    /** @type {ValueObjectAuthorization} is initialized in the constructor */
    #authorization_id;
    /** @type {ValueObjectDynamicHeader} is initialized in the constructor */
    #is_dynamic_header;
    /** @type {ValueObjectFilterInput} is initialized in the constructor */
    #filter_input;
    /** @type {ValueObjectContextPosition} is initialized in the constructor */
    #context_position;
    /** @type {ValueObjectSuccess} is initialized in the constructor */
    #on_success;
    /** @type {ValueObjectError} is initialized in the constructor */
    #on_error;
    /** @type {ValueObjectAttempts} is initialized in the constructor */
    #attempts;
    /** @type {ValueObjectInitialContext} is initialized in the constructor */
    #initial_context;
    /** @type {ValueObjectBodyType} is initialized in the constructor */
    #body_type;
    /** @type {ValueObjectCacheExpiresInPath} is initialized in the constructor */
    #cache_expires_in_path;
    /** @type {ValueObjectCacheDefaultTtlSeconds} is initialized in the constructor */
    #cache_default_ttl_seconds;

    /** @type {WSRestEndpoint|null} Relación con el endpoint de autorización */
    #authorization;

    constructor({
        id,
        type,
        description,
        url,
        method,
        headers,
        body,
        is_dynamic_body,
        is_active,
        created_at,
        updated_at,
        created_by,
        updated_by,
        deleted_at,
        deleted_by,
        authorization_id,
        is_dynamic_header,
        filter_input,
        context_position,
        on_success,
        on_error,
        attempts,
        initial_context,
        body_type,
        cache_expires_in_path,
        cache_default_ttl_seconds,
    }) {
        super(id);
        this.#type = new ValueObjectHttpRequestType('type', type);
        this.#description = new ValueObjectDescription(description ?? 'default');
        this.#url = new ValueObjectURL('url', url ?? 'default');
        this.#method = new ValueObjectHttpMethod('method', method);
        this.#headers = new ValueObjectHeaders(headers ?? { headers: {} });
        this.#body = new ValueObjectBody(body ?? { body: {} });
        this.#is_dynamic_body = new ValueObjectDynamicBody(is_dynamic_body ?? false);
        this.#is_active = new ValueObjectActive(is_active ?? false);
        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
        this.#authorization_id = new ValueObjectAuthorization(authorization_id);
        this.#is_dynamic_header = new ValueObjectDynamicHeader(is_dynamic_header ?? false);
        this.#filter_input = new ValueObjectFilterInput(filter_input);
        this.#context_position = new ValueObjectContextPosition(context_position ?? 'default');
        this.#on_success = new ValueObjectSuccess(on_success ?? { on_success: {} });
        this.#on_error = new ValueObjectError(on_error ?? { on_error: {} });
        this.#attempts = new ValueObjectAttempts(attempts ?? 0);
        this.#initial_context = new ValueObjectInitialContext(initial_context ?? null);
        this.#body_type = new ValueObjectBodyType(body_type ?? 'json');
        this.#cache_expires_in_path = new ValueObjectCacheExpiresInPath(cache_expires_in_path ?? null);
        this.#cache_default_ttl_seconds = new ValueObjectCacheDefaultTtlSeconds(cache_default_ttl_seconds ?? null);
        this.#authorization = null;
    }

    get type() {
        return this.#type;
    }

    set type(value) {
        if (this.#type.value !== value) {
            this.#type = new ValueObjectHttpRequestType('type', value);
            this.changedAttributes.type = value;
        }
    }

    get description() {
        return this.#description;
    }

    set description(value) {
        if (this.#description.value !== value) {
            this.#description = new ValueObjectDescription(value);
            this.changedAttributes.description = value;
        }
    }

    get url() {
        return this.#url;
    }

    set url(value) {
        if (this.#url.value !== value) {
            this.#url = new ValueObjectURL('url', value);
            this.changedAttributes.url = value;
        }
    }

    get method() {
        return this.#method;
    }

    set method(value) {
        if (this.#method.value !== value) {
            this.#method = new ValueObjectHttpMethod('method', value);
            this.changedAttributes.method = value;
        }
    }

    get headers() {
        return this.#headers;
    }

    set headers(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#headers.value !== value) {
            this.#headers = new ValueObjectHeaders(value);
            this.changedAttributes.headers = value;
        }
    }

    get body() {
        return this.#body;
    }

    set body(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#body.value !== value) {
            this.#body = new ValueObjectBody(value);
            this.changedAttributes.body = value;
        }
    }

    get body_type() {
        return this.#body_type;
    }

    set body_type(value) {
        if (this.#body_type.value !== value) {
            this.#body_type = new ValueObjectBodyType(value);
            this.changedAttributes.body_type = value;
        }
    }

    get is_dynamic_body() {
        return this.#is_dynamic_body;
    }

    set is_dynamic_body(value) {
        if (this.#is_dynamic_body.value !== value) {
            this.#is_dynamic_body = new ValueObjectDynamicBody(value);
            this.changedAttributes.is_dynamic_body = value;
        }
    }

    get is_active() {
        return this.#is_active;
    }

    set is_active(value) {
        if (this.#is_active.value !== value) {
            this.#is_active = new ValueObjectActive(value);
            this.changedAttributes.is_active = value;
        }
    }

    get authorization_id() {
        return this.#authorization_id;
    }

    set authorization_id(value) {
        if (this.#authorization_id.value !== value) {
            this.#authorization_id = new ValueObjectAuthorization(value);
            this.changedAttributes.authorization_id = value;
        }
    }

    get is_dynamic_header() {
        return this.#is_dynamic_header;
    }

    set is_dynamic_header(value) {
        if (this.#is_dynamic_header.value !== value) {
            this.#is_dynamic_header = new ValueObjectDynamicHeader(value);
            this.changedAttributes.is_dynamic_header = value;
        }
    }

    get filter_input() {
        return this.#filter_input;
    }

    set filter_input(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#filter_input.value !== value) {
            this.#filter_input = new ValueObjectFilterInput(value);
            this.changedAttributes.filter_input = value;
        }
    }

    get context_position() {
        return this.#context_position;
    }

    set context_position(value) {
        if (this.#context_position.value !== value) {
            this.#context_position = new ValueObjectContextPosition(value);
            this.changedAttributes.context_position = value;
        }
    }

    get on_success() {
        return this.#on_success;
    }

    set on_success(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#on_success.value !== value) {
            this.#on_success = new ValueObjectSuccess(value);
            this.changedAttributes.on_success = value;
        }
    }

    get on_error() {
        return this.#on_error;
    }

    set on_error(value) {
        // SONAR-EXC: Se quiere hacer comparaciones estrictas
        if (this.#on_error.value !== value) {
            this.#on_error = new ValueObjectError(value);
            this.changedAttributes.on_error = value;
        }
    }

    get attempts() {
        return this.#attempts;
    }

    set attempts(value) {
        if (this.#attempts.value !== value) {
            this.#attempts = new ValueObjectAttempts(value);
            this.changedAttributes.attempts = value;
        }
    }

    get initial_context() {
        return this.#initial_context;
    }

    set initial_context(value) {
        if ((this.#initial_context?.value ?? null) !== value) {
            this.#initial_context = new ValueObjectInitialContext(value);
            this.changedAttributes.initial_context = value;
        }
    }

    get cache_expires_in_path() {
        return this.#cache_expires_in_path;
    }

    set cache_expires_in_path(value) {
        if ((this.#cache_expires_in_path?.value ?? null) !== value) {
            this.#cache_expires_in_path = new ValueObjectCacheExpiresInPath(value);
            this.changedAttributes.cache_expires_in_path = value;
        }
    }

    get cache_default_ttl_seconds() {
        return this.#cache_default_ttl_seconds;
    }

    set cache_default_ttl_seconds(value) {
        if ((this.#cache_default_ttl_seconds?.value ?? null) !== value) {
            this.#cache_default_ttl_seconds = new ValueObjectCacheDefaultTtlSeconds(value);
            this.changedAttributes.cache_default_ttl_seconds = value;
        }
    }

    /**
     * Checks whether this endpoint has caching enabled.
     *
     * @returns {boolean} True if at least one cache TTL source is configured.
     */
    hasCacheEnabled() {
        return this.#cache_expires_in_path?.value != null || this.#cache_default_ttl_seconds?.value != null;
    }

    get authorization() {
        return this.#authorization;
    }

    set authorization(value) {
        this.#authorization = value;
    }

    /**
     * Establece el endpoint de autorización relacionado.
     *
     * @param {WSRestEndpoint|null} authorizationEndpoint - El endpoint de autorización.
     */
    setAuthorizationEndpoint(authorizationEndpoint) {
        this.#authorization = authorizationEndpoint;
    }

    /**
     * Verifica si este endpoint tiene un endpoint de autorización relacionado.
     *
     * @returns {boolean} Verdadero si existe una relación con un endpoint de autorización.
     */
    hasAuthorizationEndpoint() {
        return this.#authorization !== null && this.#authorization !== undefined;
    }

    /**
     * Convierte el objeto WSRestEndpoint a un formato JSON.
     *
     * @returns {Object} Representación JSON del objeto WSRestEndpoint.
     */
    toJson() {
        const json = super.toJson();

        const result = {
            ...json,
            type: this.#type.value,
            description: this.#description.value,
            url: this.#url.value,
            method: this.#method.value,
            headers: this.#headers.value,
            body: this.#body.value,
            body_type: this.#body_type.value,
            is_dynamic_body: this.#is_dynamic_body.value,
            is_active: this.#is_active.value,
            authorization_id: this.#authorization_id.value,
            is_dynamic_header: this.#is_dynamic_header.value,
            filter_input: this.#filter_input.value,
            context_position: this.#context_position.value,
            initial_context: this.#initial_context?.value ?? null,
            on_success: this.#on_success.value,
            on_error: this.#on_error.value,
            attempts: this.#attempts.value,
            cache_expires_in_path: this.#cache_expires_in_path?.value ?? null,
            cache_default_ttl_seconds: this.#cache_default_ttl_seconds?.value ?? null,
        };

        if (this.hasAuthorizationEndpoint()) {
            result.authorization = this.#authorization.toJson();
        }

        return result;
    }

    /**
     * Creates a new WSRestEndpoint object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the WSRestEndpoint object.
     * @returns {WSRestEndpoint} A new instance of the WSRestEndpoint class.
     */
    static create(dto) {
        return new WSRestEndpoint(dto);
    }
}
