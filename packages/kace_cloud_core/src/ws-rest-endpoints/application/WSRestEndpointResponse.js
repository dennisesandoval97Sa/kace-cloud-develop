export class WSRestEndpointResponse {
    /** @type {WSRestEndpoint} is initialized in the constructor */
    #wsRestEndpoint;

    /**
     * Creates an instance of `WSRestEndpointResponse`.
     *
     * @param {WSRestEndpoint} endpoint - The `WSRestEndpoint` instance.
     */
    constructor(endpoint) {
        this.#wsRestEndpoint = endpoint;
    }

    /**
     * Converts the `WSRestEndpoint` object to a JSON representation.
     *
     * @returns {Object} A flat object containing the WS REST endpoint data.
     */
    toJson() {
        if (!this.#wsRestEndpoint) return {};

        return {
            data: {
                id: this.#wsRestEndpoint.id.value,
                type: this.#wsRestEndpoint.type.value,
                description: this.#wsRestEndpoint.description.value,
                url: this.#wsRestEndpoint.url.value,
                method: this.#wsRestEndpoint.method.value,
                headers: this.#wsRestEndpoint.headers.value,
                body: this.#wsRestEndpoint.body.value,
                body_type: this.#wsRestEndpoint.body_type.value,
                is_dynamic_body: this.#wsRestEndpoint.is_dynamic_body.value,
                is_active: this.#wsRestEndpoint.is_active.value,
                created_at: this.#wsRestEndpoint.created_at.value,
                created_by: this.#wsRestEndpoint.created_by.value,
                updated_at: this.#wsRestEndpoint.updated_at.value,
                updated_by: this.#wsRestEndpoint.updated_by.value,
                authorization_id: this.#wsRestEndpoint.authorization_id.value,
                is_dynamic_header: this.#wsRestEndpoint.is_dynamic_header.value,
                filter_input: this.#wsRestEndpoint.filter_input.value,
                context_position: this.#wsRestEndpoint.context_position.value,
                on_success: this.#wsRestEndpoint.on_success.value,
                on_error: this.#wsRestEndpoint.on_error.value,
                attempts: this.#wsRestEndpoint.attempts.value,
                initial_context: this.#wsRestEndpoint.initial_context?.value ?? null,
                cache_expires_in_path: this.#wsRestEndpoint.cache_expires_in_path?.value ?? null,
                cache_default_ttl_seconds: this.#wsRestEndpoint.cache_default_ttl_seconds?.value ?? null,
            },
        };
    }
}
