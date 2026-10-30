import { TemplateResponse } from './TemplateResponse';

export class TemplatesCollectionResponse {
    /**
     * @type {TemplatesCollectionResponse}
     */
    #templates; // is initialized in the constructor
    /**
     * @type {number}
     */
    #count; // is initialized in the constructor

    constructor(templates, count) {
        this.#templates = templates;
        this.#count = count;
    }

    /**
     *
     * @returns {TemplatesCollectionResponse[]} An array plain Object contains the global config data
     */
    toJson() {
        return {
            data: {
                items: this.#templates.map((templates) => new TemplateResponse(templates).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
