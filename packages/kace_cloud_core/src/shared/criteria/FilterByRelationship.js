import { Relationship } from './Relationship';

export class FilterByRelationship {
    /**
     * @param {Array} relationship
     */
    constructor(relationship) {
        this.relationship = relationship;
    }

    static fromValues(relationship) {
        return new FilterByRelationship(relationship?.map(Relationship.fromPrimitives));
    }
}
