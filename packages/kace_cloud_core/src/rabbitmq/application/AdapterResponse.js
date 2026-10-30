/**
 * AdapterResponse represents the sanitized DTO returned by adapter application operations.
 */
export class AdapterResponse {
    /** @type {Object} is initialized in the constructor */
    #adapter;

    /**
     * Creates an instance of `AdapterResponse`.
     *
     * @param {Object} adapter - Domain adapter instance or plain object with value objects
     */
    constructor(adapter) {
        this.#adapter = adapter;
    }

    /**
     * Converts the adapter domain object to a JSON representation.
     *
     * @returns {Object} A flat object containing the adapter data inside `data`.
     */
    toJson() {
        if (!this.#adapter) return {};

        return {
            data: {
                id: this.#adapter.id?.value ?? this.#adapter.id,
                name: this.#adapter.name?.value ?? this.#adapter.name,
                host: this.#adapter.host?.value ?? this.#adapter.host,
                port: this.#adapter.port?.value ?? this.#adapter.port,
                queue: this.#adapter.queue?.value ?? this.#adapter.queue,
                vhost: this.#adapter.vhost?.value ?? this.#adapter.vhost ?? null,
                exchange: this.#adapter.exchange?.value ?? this.#adapter.exchange ?? null,
                username: this.#adapter.username?.value ?? this.#adapter.username ?? null,
                password: this.#adapter.password?.value ?? this.#adapter.password ?? null,
                created_at: this.#adapter.created_at?.value ?? this.#adapter.created_at ?? null,
                updated_at: this.#adapter.updated_at?.value ?? this.#adapter.updated_at ?? null,
            },
        };
    }
}
