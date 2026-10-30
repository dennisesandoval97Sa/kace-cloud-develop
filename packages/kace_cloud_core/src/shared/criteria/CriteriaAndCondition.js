import { COMPARISION_OPERATORS } from './FilterOperator';
import { buildJsonPathDateBetweenClause } from './JsonPathDateBetween.js';
import { Helper } from '../index';

export class CriteriaAndCondition {
    /** @type {String} is initialized in the constructor */
    #comparisonOp;
    /** @type {String} is initialized in the constructor */
    #field;
    /** @type {String|Boolean|Number} is initialized in the constructor */
    #value;
    /** @type {String} is initialized in the constructor */
    #query;
    constructor(comparisonOp, field, value, query) {
        this.#comparisonOp = comparisonOp;
        this.#field = field;
        this.#value = value;
        this.#query = query;
    }

    execute() {
        try {
            if (this.#comparisonOp === COMPARISION_OPERATORS.null) {
                return this.#query.whereNull(this.#field);
            }

            if (this.#comparisonOp === COMPARISION_OPERATORS.notNull) {
                return this.#query.whereNotNull(this.#field);
            }

            if (this.#comparisonOp === COMPARISION_OPERATORS.between) {
                return this.#query.andWhereBetween(this.#field, this.#value);
            }

            if (this.#comparisonOp === COMPARISION_OPERATORS.jsonContains) {
                return this.#query.whereRaw(`??::jsonb @> ?::jsonb`, [this.#field, this.#value]);
            }

            if (this.#comparisonOp === COMPARISION_OPERATORS.jsonPathDateBetween) {
                return this.#query.whereRaw(...buildJsonPathDateBetweenClause(this.#field, this.#value));
            }

            if (this.#comparisonOp === COMPARISION_OPERATORS.jsonArrayValue) {
                return this.#query.whereRaw(`${this.#field}::jsonb \\?| array[?]`, [this.#value.join(',')]);
            }

            if (this.#comparisonOp === COMPARISION_OPERATORS.jsonPathEmpty) {
                const jsonbPath = this.#value != null && this.#value !== 'null' ? String(this.#value).trim() : null;
                if (!jsonbPath) {
                    return this.#query.whereRaw(`(?? IS NULL OR ??::text = '')`, [this.#field, this.#field]);
                }
                const parts = jsonbPath.split('.');
                const accessor = parts.length === 1 ? `??->>?` : `??#>>?`;
                const pathValue = parts.length === 1 ? parts[0] : `{${parts.join(',')}}`;
                return this.#query.whereRaw(`(${accessor} IS NULL OR ${accessor} = '')`, [
                    this.#field,
                    pathValue,
                    this.#field,
                    pathValue,
                ]);
            }

            if (this.#comparisonOp === COMPARISION_OPERATORS.jsonNotPathEmpty) {
                const jsonbPath = this.#value != null && this.#value !== 'null' ? String(this.#value).trim() : null;
                if (!jsonbPath) {
                    return this.#query.whereRaw(`(?? IS NOT NULL AND ??::text != '')`, [this.#field, this.#field]);
                }
                const parts = jsonbPath.split('.');
                const accessor = parts.length === 1 ? `??->>?` : `??#>>?`;
                const pathValue = parts.length === 1 ? parts[0] : `{${parts.join(',')}}`;
                return this.#query.whereRaw(`(${accessor} IS NOT NULL AND ${accessor} != '')`, [
                    this.#field,
                    pathValue,
                    this.#field,
                    pathValue,
                ]);
            }

            return this.#query.andWhere(this.#field, this.#comparisonOp, this.#value);
        } catch (error) {
            Helper.logError(error);
            throw new Error(error);
        }
    }
}
