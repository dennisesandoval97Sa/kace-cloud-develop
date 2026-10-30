export class SubCaseRelationResponse {
    /** @type {SubcasesRelationship} */
    #relation;

    /**
     * @param {SubcasesRelationship} relation
     */
    constructor(relation) {
        this.#relation = relation;
    }

    toJson() {
        if (!this.#relation) return {};
        return {
            data: {
                parent_case_id: this.#relation.parent_case_id.value,
                child_case_id: this.#relation.child_case_id.value,
            },
        };
    }
}
