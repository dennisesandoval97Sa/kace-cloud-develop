import { ValueObjectBoolean } from '../../shared/domain/value-object/ValueObjectBoolean.js';
import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';
import { ValueObjectModules } from './value-object/ValueObjectModules.js';

export class Permissions {
    /** @type {ValueObjectString} is initialized in the constructor */
    #name;
    /** @type {ValueObjectString} is initialized in the constructor */
    #description;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #granted;
    /** @type {ValueObjectModules} is initialized in the constructor */
    #module_id;

    /**
     * Constructs a Permissions instance.
     * @param {string} name - The permission's name.
     * @param {string} description - The permission's description.
     * @param {Boolean} granted - The permission's granted.
     * @param {ModulesEnums} module_id - The permission's module_id.
     */
    constructor(name, description, granted, module_id) {
        this.#name = new ValueObjectString(`${name}_permission`, name);
        this.#description = new ValueObjectString(`${name}_permission_description`, description);
        this.#granted = new ValueObjectBoolean(`granted`, granted);
        this.#module_id = new ValueObjectModules('module_id', module_id);
    }

    get name() {
        return this.#name.value;
    }

    set name(value) {
        this.#name = new ValueObjectString(`${value}_permission`, value);
    }

    get description() {
        return this.#description.value;
    }

    set description(value) {
        this.#description = new ValueObjectString(`${value}_permission_description`, value);
    }

    get granted() {
        return this.#granted.value;
    }

    set granted(value) {
        this.#granted = new ValueObjectBoolean('granted', value);
    }

    get module_id() {
        return this.#module_id.value;
    }

    set module_id(value) {
        this.#module_id = new ValueObjectModules('module_id', value);
    }

    /**
     * Creates a Permissions instance from primitive values.
     * @param {string} name - The permission's name.
     * @param {string} description - The permission's description.
     * @param {Boolean} granted - The permission's granted.
     * @param {ModulesEnums} module_id - The permission's module_id.
     * @returns {Permissions} The created Permissions instance.
     */
    static fromPrimitives(name, description, granted, module_id) {
        return new Permissions(name, description, granted, module_id);
    }

    /**
     * Converts the current Permissions instance to a primitive object.
     * @returns {Object} The primitive object representing the current Permissions instance
     */
    toPrimitives() {
        return {
            name: this.#name.value,
            description: this.#description.value,
            granted: this.#granted.value,
            module_id: this.#module_id.value,
        };
    }
}
