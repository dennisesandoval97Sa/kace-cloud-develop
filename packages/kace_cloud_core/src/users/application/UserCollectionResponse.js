import { UserResponse } from './UserResponse';

export class UserCollectionResponse {
    /** @type {User[]} is initialized in the constructor */
    #userCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(userCollection, count) {
        this.#userCollection = userCollection;
        this.#count = count;
    }

    /**
     * Converts the User object to a JSON representation.
     *
     * @returns {Object} A plain object containing the User data.
     */
    toJson() {
        return {
            data: {
                items: this.#userCollection.map((user) => new UserResponse(user).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
