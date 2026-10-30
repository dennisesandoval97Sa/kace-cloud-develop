import { RoleResponse } from './RoleResponse';

export class RoleCollectionResponse {
    /** @type {Role[]} is initialized in the constructor */
    #roles;

    /** @type {number} is initialized in the constructor */
    #count;

    constructor(roles, count) {
        this.#roles = roles;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#roles.map((role) => new RoleResponse(role).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
