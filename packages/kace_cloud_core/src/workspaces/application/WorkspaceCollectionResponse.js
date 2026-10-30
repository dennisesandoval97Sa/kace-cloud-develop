import { WorkspaceResponse } from './WorkspaceResponse.js';

export class WorkspaceCollectionResponse {
    /** @type {Workspaces[]} is initialized in the constructor */
    #workspaces;

    /** @type {integer} is initialized in the constructor */
    #count;
    /**
     *
     * @param {Workspaces[]} workspaces
     */

    constructor(workspaces, count) {
        this.#workspaces = workspaces;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#workspaces.map((workspace) => new WorkspaceResponse(workspace).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
