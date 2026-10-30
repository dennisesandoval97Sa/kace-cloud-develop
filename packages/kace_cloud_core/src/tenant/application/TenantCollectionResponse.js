import { TenantResponse } from './TenantResponse.js';

export class TenantCollectionResponse {
    /** @type {Tenant[]} is initialized in the constructor */
    #tenantCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(tenantCollection, count) {
        this.#tenantCollection = tenantCollection;
        this.#count = count;
    }

    /**
     * Converts the Tenant collection to a JSON representation.
     *
     * @returns {Object} A plain object containing the Tenant collection data.
     */
    toJson() {
        return {
            data: {
                items: this.#tenantCollection.map((tenant) => new TenantResponse(tenant).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
