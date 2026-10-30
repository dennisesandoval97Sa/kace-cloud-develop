import { GroupListResponse } from './GroupListResponse.js';

export class GroupListCollectionResponse {
    /** @type {GroupList[]} is initialized in the constructor */
    #groupListCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(groupListCollection, count) {
        this.#groupListCollection = groupListCollection;
        this.#count = count;
    }

    /**
     * Converts the GroupList object to a JSON representation.
     *
     * @returns {Object} A plain object containing the GroupList data.
     */
    toJson() {
        return {
            data: {
                items: this.#groupListCollection.map((groupList) => new GroupListResponse(groupList).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
