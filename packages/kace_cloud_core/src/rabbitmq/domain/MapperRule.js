import { ValueObjectString } from './value-objects/ValueObjectString.js';
import { ValueObjectUuid, CustomError } from '../../shared/index.js';

export class MapperRule {
    VALID_PARSE_TO_VALUES = ['string', 'number', 'boolean', 'datetime'];
    /**
     * @type {ValueObjectUuid} private id (uuid)
     */
    #id;

    /**
     * @type {ValueObjectString} private mapper_id (uuid)
     */
    #mapper_id;

    /**
     * @type {ValueObjectString} private target_entity
     */
    #target_entity;

    /**
     * @type {ValueObjectString} private target_field
     */
    #target_field;

    /**
     * @type {ValueObjectString} private source_field
     */
    #source_field;

    /**
     * @type {ValueObjectString} private parse_to
     */
    #parse_to;

    /**
     * @param {Object} params
     * @param {string} params.id
     * @param {string} params.mapper_id
     * @param {string} params.target_entity
     * @param {string} params.target_field
     * @param {string} params.source_field
     * @param {string} params.parse_to
     */
    constructor({ id, mapper_id, target_entity, target_field, source_field, parse_to }) {
        if (id !== undefined && id !== null) {
            this.#id = new ValueObjectUuid('id', id).value;
        } else {
            this.#id = null;
        }

        this.#mapper_id = new ValueObjectUuid('mapper_id', mapper_id).value;
        this.#target_entity = new ValueObjectString('target_entity', target_entity).value;
        this.#target_field = new ValueObjectString('target_field', target_field).value;
        this.#source_field = new ValueObjectString('source_field', source_field).value;
        this.#parse_to = new ValueObjectString('parse_to', parse_to, true).value;
    }

    static create(dto) {
        if (!dto) throw new CustomError('MapperRule invalid: dto is required');
        const { mapper_id, target_entity, target_field, source_field } = dto;
        if (!mapper_id) throw new CustomError('MapperRule invalid: mapper_id is required');
        if (!target_entity) throw new CustomError('MapperRule invalid: target_entity is required');
        if (!target_field) throw new CustomError('MapperRule invalid: target_field is required');
        if (!source_field) throw new CustomError('MapperRule invalid: source_field is required');
        return new MapperRule(dto);
    }

    get id() {
        return this.#id;
    }

    get mapper_id() {
        return this.#mapper_id;
    }

    get target_entity() {
        return this.#target_entity;
    }

    get target_field() {
        return this.#target_field;
    }

    get source_field() {
        return this.#source_field;
    }

    get parse_to() {
        return this.#parse_to;
    }
}
