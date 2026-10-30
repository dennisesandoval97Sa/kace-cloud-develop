import { UserListResponse } from './UserListResponse.js';

export class UserListCollectionResponse {
    /** @type {UserList[]} is initialized in the constructor */
    #userListCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(userListCollection, count) {
        this.#userListCollection = userListCollection;
        this.#count = count;
    }

    /**
     * Converts the UserList object to a JSON representation.
     *
     * @returns {Object} A plain object containing the UserList data.
     */
    toJson() {
        return {
            data: {
                items: this.#userListCollection.map((userList) => new UserListResponse(userList).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
