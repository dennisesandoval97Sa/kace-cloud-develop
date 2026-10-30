import { ValueObjectString } from '../value-object/ValueObjectString.js';
import {ValueObjectJson} from "../value-object/ValueObjectJson.js";

/**
 * @class Relations
 *
 * Representa una relación entre dos entidades de base de datos,
 * incluyendo su condición de unión.
 */
export class Relations {
    /** @type {ValueObjectString} */
    #entity;
    /** @type {ValueObjectString} */
    #relation;
    /** @type {ValueObjectJson} */
    #join_condition;
    /** @type {ValueObjectString} */
    #alias;

    /**
     * @param {Object} dto
     * @param {string} dto.id - Identificador del agregado
     * @param {string} dto.entity - Nombre de la entidad origen
     * @param {string} dto.relation - Nombre de la entidad relacionada
     * @param {Object} dto.join_condition - Condición de unión (ej: "users.id = orders.user_id")
     * @param {string} dto.alias - Alias único usado para referenciar la relación en la consulta (se utiliza en JOIN, SELECT o WHERE para evitar ambigüedades)
     */
    constructor(dto) {
        this.#entity = new ValueObjectString('relations entity', dto.entity);
        this.#relation = new ValueObjectString('relations relation', dto.relation);
        this.#join_condition = new ValueObjectJson('relations join_condition', dto.join_condition);
        this.#alias = new ValueObjectString('relations alias', dto.alias, true);
    }

    /** @returns {ValueObjectString} */
    get entity() {
        return this.#entity;
    }

    /** @param {string} value */
    set entity(value) {
        this.#entity = new ValueObjectString('relations entity', value);
    }

    /** @returns {ValueObjectString} */
    get relation() {
        return this.#relation;
    }

    /** @param {string} value */
    set relation(value) {
        this.#relation = new ValueObjectString('relations relation', value);
    }

    /** @returns {ValueObjectJson} */
    get join_condition() {
        return this.#join_condition;
    }

    /** @param {ValueObjectJson} value */
    set join_condition(value) {
        this.#join_condition = new ValueObjectJson('relations join_condition', value);
    }

    /** @returns {ValueObjectString} */
    get alias() {
        return this.#alias;
    }

    /** @param {string} value */
    set alias(value) {
        this.#alias = new ValueObjectString('relations alias', value);
    }

    /**
     * Fábrica estática para crear instancias del agregado
     * @param {Object} dto
     * @returns {Relations}
     */
    static create(dto) {
        return new Relations(dto);
    }
}
