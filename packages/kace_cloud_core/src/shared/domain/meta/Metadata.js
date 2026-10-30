import { Criteria } from '../../criteria/Criteria.js';

export class Metadata {
    /** is initialized in the constructor*/
    #criteria;
    /** is initialized in the constructor*/
    #count;

    constructor({ criteria, count }) {
        this.ensureIsValidCriteria(criteria);
        this.#criteria = criteria;
        this.#count = count;
    }

    ensureIsValidCriteria(criteria) {
        if (criteria && !(criteria instanceof Criteria)) {
            throw new Error('Metadata must have a criteria');
        }
    }

    toJson() {
        return {
            filters: this.#criteria.filters.toJson(),
            order: this.#criteria.order.toJson(),
            limit: this.#criteria.limit,
            offset: this.#criteria.offset,
            count: this.#count,
        };
    }
}
