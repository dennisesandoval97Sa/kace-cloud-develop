import { ValueObjectString, ValueObjectUuid } from '../../shared';

export class ClassificationGroupRelationship {
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #classification_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #group_id;
    /** @type {ValueObjectString | null} is initialized in the constructor */
    #form;
    /** @type {ValueObjectString} is initialized in the constructor */
    #nombre_grupo;
    /** @type {ValueObjectString} is initialized in the constructor */
    #nombre_one_script;

    /**
     * Creates an instance of ClassificationGroupRelationship.
     * @param {Object} dto - The parameters for creating the relationship.
     * @param {string} dto.classification_id - The ID of the classification.
     * @param {string} dto.group_id - The ID of the group.
     * @param {string} [dto.form] - The form or additional data for the relationship (optional).
     * @param {string} dto.nombre - The Name of the group..
     * @param {string} dto.name - The Name of the one-script.
     */
    constructor({ classification_id, group_id, form, nombre, name }) {
        this.#classification_id = new ValueObjectUuid('classification_id', classification_id);
        this.#group_id = new ValueObjectUuid('group_id', group_id);
        this.#form = new ValueObjectString('form', form, true);
        this.#nombre_grupo = new ValueObjectString('nombre_grupo', nombre, true);
        this.#nombre_one_script = new ValueObjectString('nombre_one_script', name, true);
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

    get group_id() {
        return this.#group_id;
    }

    set group_id(value) {
        if (this.#group_id.value !== value) {
            this.#group_id = new ValueObjectUuid('group_id', value);
            this.changedAttributes.group_id = value;
        }
    }

    get form() {
        return this.#form;
    }

    set form(value) {
        if (this.#form.value !== value) {
            this.#form = new ValueObjectString('form', value);
            this.changedAttributes.form = value;
        }
    }

    get nombre_grupo() {
        return this.#nombre_grupo;
    }

    set nombre_grupo(value) {
        if (this.#nombre_grupo.value !== value) {
            this.#nombre_grupo = new ValueObjectString('nombre_grupo', value, true);
        }
    }

    get nombre_one_script() {
        return this.#nombre_one_script;
    }

    set nombre_one_script(value) {
        if (this.#nombre_one_script.value !== value) {
            this.#nombre_one_script = new ValueObjectString('nombre_one_script', value, true);
        }
    }

    /**
     * Creates a new ClassificationGroupRelationship object from the provided data transfer object (DTO).
     * @param {Object} dto - The data transfer object containing the properties for the ClassificationGroupRelationship object.
     * @returns {ClassificationGroupRelationship} A new instance of the ClassificationGroupRelationship class.
     */
    static create(dto) {
        return new ClassificationGroupRelationship(dto);
    }
}
