import { ValueObjectName } from './value-objects/ValueObjectName.js';
import { ValueObjectUuid, CustomError } from '../../shared/index.js';

export class Mapper {
    /**
     * @type {string} private id (uuid)
     */
    #id;

    /**
     * @type {string} private name
     */
    #name;

    /**
     * @type {string} private rest_flow_id (uuid)
     */
    #rest_flow_id;

    /**
     * @type {string} private queue
     */
    #queue;

    /**
     * @type {Array} private rules
     */
    #rules;

    /**
     * @type {string|null} private created_at
     */
    #created_at;

    /**
     * @type {string|null} private updated_at
     */
    #updated_at;

    /**
     * @param {Object} params
     * @param {string} params.id
     * @param {string} params.name
     * @param {string} params.rest_flow_id
     * @param {string} params.queue
     * @param {Array} params.rules
     * @param {string|null} params.created_at
     * @param {string|null} params.updated_at
     */
    constructor({ id, name, queue, rest_flow_id, rules = [], created_at = null, updated_at = null }) {
        if (id !== undefined && id !== null) {
            this.#id = new ValueObjectUuid('id', id).value;
        } else {
            this.#id = null;
        }

        this.#name = new ValueObjectName(name).value;
        this.#rest_flow_id = rest_flow_id;
        this.#queue = queue;
        this.#rules = Array.isArray(rules) ? rules : [];
        this.#created_at = created_at;
        this.#updated_at = updated_at;
    }

    static create(dto) {
        if (!dto) throw new CustomError('Mapper invalid: dto is required');
        const { name, rest_flow_id, queue, rules } = dto;
        if (!name) throw new CustomError('Mapper invalid: name is required');
        if (!rest_flow_id) throw new CustomError('Mapper invalid: rest_flow_id is required');
        if (!Array.isArray(rules)) throw new CustomError('Mapper invalid: rules must be an array');
        return new Mapper(dto);
    }

    get id() {
        return this.#id;
    }

    get name() {
        return this.#name;
    }

    get rest_flow_id() {
        return this.#rest_flow_id;
    }

    get queue() {
        return this.#queue;
    }

    get rules() {
        return this.#rules;
    }

    get created_at() {
        return this.#created_at;
    }

    get updated_at() {
        return this.#updated_at;
    }
}
