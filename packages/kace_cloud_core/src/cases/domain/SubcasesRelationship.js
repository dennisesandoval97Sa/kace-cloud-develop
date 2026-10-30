import { ValueObjectUuid } from '../../shared';

export class SubcasesRelationship {
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #parent_case_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #child_case_id;
    /**
     * Creates an instance of UserGroupRelationship.
     * @param {Object} dto - The parameters for creating the relationship.
     * @param {string} dto.parent_case_id - The ID of the parent.
     * @param {string} dto.child_case_id - The ID of the child.
     */
    constructor({ parent_case_id, child_case_id }) {
        this.#parent_case_id = new ValueObjectUuid('parent_case_id', parent_case_id);
        this.#child_case_id = new ValueObjectUuid('child_case_id', child_case_id);
    }

    get parent_case_id() {
        return this.#parent_case_id;
    }

    set parent_case_id(value) {
        if (this.#parent_case_id.value !== value) {
            this.#parent_case_id = new ValueObjectUuid('parent_case_id', value);
        }
    }

    get child_case_id() {
        return this.#child_case_id;
    }

    set child_case_id(value) {
        if (this.#child_case_id.value !== value) {
            this.#child_case_id = new ValueObjectUuid('child_case_id', value);
        }
    }

    /**
     * Creates a new SubcasesRelationship object from the provided data transfer object (DTO).
     * @param {Object} dto - The data transfer object containing the properties for the SubcasesRelationship object.
     * @returns {SubcasesRelationship} A new instance of the SubcasesRelationship class.
     */
    static create(dto) {
        return new SubcasesRelationship(dto);
    }
}
