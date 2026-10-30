import { GroupResponse } from '../index';

export class GroupCollectionResponse {
    /** @type {Groups[]} is initialized in the constructor */
    #groups;

    /** @type {integer} is initialized in the constructor */
    #count;
    /**
     *
     * @param {Groups[]} groups
     */

    constructor(groups, count) {
        this.#groups = groups;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#groups.map((group) => new GroupResponse(group).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
