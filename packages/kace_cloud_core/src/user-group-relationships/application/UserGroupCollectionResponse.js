import { UserGroupResponse } from './UserGroupResponse';

export class UserGroupCollectionResponse {
    /** @type {UserGroupRelationship[]} is initialized in the constructor */
    #userGroupCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(userGroupCollection, count) {
        this.#userGroupCollection = userGroupCollection;
        this.#count = count;
    }

    /**
     * Converts the User Group Relation object to a JSON representation.
     *
     * @returns {Object} A plain object containing the User Group Relation data.
     */
    toJson() {
        return {
            data: {
                items: this.#userGroupCollection.map((userGroup) => new UserGroupResponse(userGroup).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
