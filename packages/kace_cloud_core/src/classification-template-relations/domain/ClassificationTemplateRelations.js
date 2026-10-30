import { ValueObjectUuid } from '../../shared';

export class ClassificationTemplateRelations {
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #classification_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #template_id;

    /**
     * Creates an instance of ClassificationTemplateRelations.
     * @param {Object} dto - The parameters for creating the relationship.
     * @param {string} dto.classification_id - The ID of the classification.
     * @param {string} dto.template_id - The ID of the template.
     */
    constructor({ classification_id, template_id }) {
        this.#classification_id = new ValueObjectUuid('classification_id', classification_id);
        this.#template_id = new ValueObjectUuid('template_id', template_id);
        this.changedAttributes = {};
    }

    get classification_id() {
        return this.#classification_id;
    }

    set classification_id(value) {
        if (this.#classification_id.value !== value) {
            this.#classification_id = new ValueObjectUuid('classification_id', value);
            this.changedAttributes.classification_id = value;
        }
    }

    get template_id() {
        return this.#template_id;
    }

    set template_id(value) {
        if (this.#template_id.value !== value) {
            this.#template_id = new ValueObjectUuid('template_id', value);
            this.changedAttributes.template_id = value;
        }
    }

    /**
     * Creates a new ClassificationTemplateRelations object from the provided data transfer object (DTO).
     * @param {Object} dto - The data transfer object containing the properties for the ClassificationTemplateRelations object.
     * @returns {ClassificationTemplateRelations} A new instance of the ClassificationTemplateRelations class.
     */
    static create(dto) {
        return new ClassificationTemplateRelations(dto);
    }
}
