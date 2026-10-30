import { v4 as uuidv4 } from 'uuid';
import Chance from 'chance';
import { Helper } from '../shared/infrastructure/utils/Helper.js';
import TestHelper from '../../tests/TestHelper.js';

export const chance = new Chance();
export { uuidv4 };

export class Factory {
    /** @type {KnexRepository} is initialized in the constructor*/
    #repository;
    /** @type {Array} is initialized in the constructor*/
    #afterMaking;
    /** @type {Array} is initialized in the constructor*/
    #afterCreating;
    /** @type {*} knex or knex config passed in */
    #knex;

    /**
     * Creates an instance of Factory.
     * @param {Function} repository - Repository constructor.
     * @param {Function} model - Data model.
     * @param {Object} [defaultAttributes={}] - Default attributes.
     * @param {*} knexConfig - instancia de knex o config compatible con tus repos
     */
    constructor(repository, model, defaultAttributes = {}, knexConfig) {
        if (!knexConfig) {
            throw new Error('Factory requires a knex instance/config in the constructor');
        }
        this.#knex = knexConfig;
        this.#repository = new repository(this.#knex);
        this.model = model;
        this.defaultAttributes = defaultAttributes;
        this.states = {};
        this.relations = {};
        this.#afterMaking = [];
        this.#afterCreating = [];
    }

    /**
     * Defines default attributes.
     * @param {Object} attributes - Attributes to define.
     * @returns {Factory} The Factory instance.
     */
    define(attributes = {}) {
        this.defaultAttributes = { ...this.defaultAttributes, ...attributes };
        return this;
    }

    /**
     * Defines a state with specific attributes.
     * @param {string} name - Name of the state.
     * @param {Object} attributes - Attributes of the state.
     * @returns {Factory} The Factory instance.
     */
    state(name, attributes) {
        this.states[name] = attributes;
        return this;
    }

    /**
     * Adds a callback to be executed after creating the instance in memory.
     * @param {Function} callback - Function to execute.
     * @returns {Factory} The Factory instance.
     */
    afterMaking(callback) {
        this.#afterMaking.push(callback);
        return this;
    }

    /**
     * Adds a callback to be executed after saving the instance to the database.
     * @param {Function} callback - Function to execute.
     * @returns {Factory} The Factory instance.
     */
    afterCreating(callback) {
        this.#afterCreating.push(callback);
        return this;
    }

    /**
     * Defines a relationship with another factory.
     * @param {string} name - Name of the relationship.
     * @param {Factory} factory - Related factory instance.
     * @returns {Factory} The Factory instance.
     */
    relation(name, factory) {
        this.relations[name] = factory;
        return this;
    }

    /**
     * Resolves relationships and adds their IDs to the attributes.
     * @param {Object} attributes - Attributes to resolve.
     * @returns {Promise<Object>} Resolved attributes.
     * @private
     */
    async #resolveRelations(attributes) {
        for (const [key, factory] of Object.entries(this.relations)) {
            if (!(key in attributes)) {
                const relatedInstance = await factory.create();
                attributes[`${key}`] = relatedInstance.id.value;
            }
        }
        return attributes;
    }

    /**
     * Generates and returns the attributes as a JSON object.
     * @param {Object} [overrides={}] - Attributes that override the defaults.
     * @param {string|null} [state=null] - Optional state to define specific attributes.
     * @returns {Promise<Object>} Generated attributes.
     */
    async generateAttributes(overrides = {}, state = null) {
        let attributes = this.#getAttributes(overrides, state);
        attributes = await this.#resolveRelations(attributes);
        return attributes;
    }

    /**
     * Creates an instance in memory without saving it.
     * @param {Object} [overrides={}] - Attributes that override default ones.
     * @param state
     * @returns {Promise<Object>} The created instance.
     */
    async make(overrides = {}, state = null) {
        let attributes = await this.generateAttributes(overrides, state);
        const instance = new this.model(attributes);
        await this.#callAfterMaking(instance);
        return instance;
    }

    /**
     * Creates and saves an instance to the database.
     * @param {Object} [overrides={}] - Attributes that override default ones.
     * @param state
     * @returns {Promise<Object>} The created and saved instance.
     * @throws {Error} Error when creating the instance.
     */
    async create(overrides = {}, state = null) {
        try {
            const instance = await this.make(overrides, state);
            await this.#repository.save(instance);
            await this.#callAfterCreating(instance);
            return instance;
        } catch (error) {
            const errorMessage = 'Error creating factory instance';
            Helper.logError(`${errorMessage}:`, error);
            // El mensaje original va en el texto ademas de en la causa: cuando el fallo es
            // aleatorio, el `it` al que se imputa cambia en cada corrida y el sintoma escueto
            // no permite ni empezar a buscar.
            throw new Error(`${errorMessage}: ${error.message}`, { cause: error });
        }
    }

    /**
     * Creates and saves multiple instances to the database.
     * @param {number} count - Number of instances to create.
     * @param {Object} [overrides={}] - Attributes that override default ones.
     * @param state
     * @returns {Promise<Array<Object>>} Array of created instances.
     */
    async createMany(count, overrides = {}, state = null) {
        const instances = [];
        for (let i = 0; i < count; i++) {
            instances.push(await this.create(overrides, state));
        }
        return instances;
    }

    /**
     * Gets final attributes considering defaults and overrides.
     * @param {Object} overrides - Attributes that override default ones.
     * @param state
     * @returns {Object} Final attributes.
     * @private
     */
    #getAttributes(overrides, state = null) {
        let attributes = { ...this.defaultAttributes };

        if (state && this.states[state]) {
            attributes = { ...attributes, ...this.states[state] };
        }
        for (const [key, value] of Object.entries(attributes)) {
            if (typeof value === 'function') {
                attributes[key] = TestHelper.generateSafeValue(value);
            }
        }

        return { ...attributes, ...overrides };
    }

    /**
     * Calls afterMaking callbacks with the created instance.
     * @param {Object} instance - The created instance.
     * @private
     */
    async #callAfterMaking(instance) {
        for (const callback of this.#afterMaking) {
            await callback(instance);
        }
    }

    /**
     * Calls afterCreating callbacks with the created instance.
     * @param {Object} instance - The created instance.
     * @private
     */
    async #callAfterCreating(instance) {
        for (const callback of this.#afterCreating) {
            await callback(instance);
        }
    }
}
