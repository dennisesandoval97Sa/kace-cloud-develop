/**
 * MapperResponse represents the DTO returned by mapper application operations.
 */
export class MapperResponse {
    /**
     * @param {{id:string,name:string,queue:string,rest_flow_id:string,rules:Array,created_at:string|null,updated_at:string|null}} params
     */
    constructor({ id, name, queue, rest_flow_id, rules, created_at, updated_at }) {
        /** @type {string} */
        this.id = id;
        /** @type {string} */
        this.name = name;
        /** @type {string} */
        this.rest_flow_id = rest_flow_id;
        /** @type {Array} */
        this.rules = rules;
        /** @type {string} */
        this.queue = queue;
        /** @type {string|null} */
        this.created_at = created_at;
        /** @type {string|null} */
        this.updated_at = updated_at;
    }

    /**
     * Convert to plain JSON
     * @returns {Object}
     */
    toJson() {
        return {
            data: {
                id: this.id?.value ?? this.id,
                name: this.name?.value ?? this.name,
                queue: this.queue?.value ?? this.queue,
                rest_flow_id: this.rest_flow_id?.value ?? this.rest_flow_id,
                rules: this.rules ?? [],
                created_at: this.created_at?.value ?? this.created_at ?? null,
                updated_at: this.updated_at?.value ?? this.updated_at ?? null,
            },
        };
    }
}
