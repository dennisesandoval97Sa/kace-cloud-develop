import { COMPARISION_OPERATORS } from './FilterOperator';
import { buildJsonPathDateBetweenClause } from './JsonPathDateBetween.js';

export class CriteriaOrCondition {
    /**
     * Creates an instance of CriteriaOrCondition.
     *
     * @param {string} comparisonOp - The comparison operator.
     * @param {string} field - The field to evaluate.
     * @param {any} value - A value associated with the field.
     * @param {Object} query - The associated query.
     */
    constructor(comparisonOp, field, value, query) {
        this.comparisonOp = comparisonOp;
        this.field = field;
        this.value = value;
        this.query = query;
    }

    execute() {
        if (this.comparisonOp === COMPARISION_OPERATORS.null) {
            return this.query.orWhereNull(this.field);
        }

        if (this.comparisonOp === COMPARISION_OPERATORS.notNull) {
            return this.query.orWhereNotNull(this.field);
        }

        if (this.comparisonOp === COMPARISION_OPERATORS.between) {
            return this.query.orWhereBetween(this.field, this.value);
        }

        if (this.comparisonOp === COMPARISION_OPERATORS.jsonContains) {
            return this.query.orWhereRaw(`??::jsonb @> ?::jsonb`, [this.field, this.value]);
        }

        if (this.comparisonOp === COMPARISION_OPERATORS.jsonPathDateBetween) {
            return this.query.orWhereRaw(...buildJsonPathDateBetweenClause(this.field, this.value));
        }

        if (this.comparisonOp === COMPARISION_OPERATORS.jsonArrayValue) {
            return this.query.orWhereRaw(`${this.field}::jsonb \\?| array[?]`, [this.value.join(',')]);
        }

        if (this.comparisonOp === COMPARISION_OPERATORS.jsonPathEmpty) {
            const jsonbPath = this.value != null && this.value !== 'null' ? String(this.value).trim() : null;
            if (!jsonbPath) {
                return this.query.orWhereRaw(`(?? IS NULL OR ??::text = '')`, [this.field, this.field]);
            }
            const parts = jsonbPath.split('.');
            const accessor = parts.length === 1 ? `??->>?` : `??#>>?`;
            const pathValue = parts.length === 1 ? parts[0] : `{${parts.join(',')}}`;
            return this.query.orWhereRaw(`(${accessor} IS NULL OR ${accessor} = '')`, [
                this.field,
                pathValue,
                this.field,
                pathValue,
            ]);
        }

        if (this.comparisonOp === COMPARISION_OPERATORS.jsonNotPathEmpty) {
            const jsonbPath = this.value != null && this.value !== 'null' ? String(this.value).trim() : null;
            if (!jsonbPath) {
                return this.query.orWhereRaw(`(?? IS NOT NULL AND ??::text != '')`, [this.field, this.field]);
            }
            const parts = jsonbPath.split('.');
            const accessor = parts.length === 1 ? `??->>?` : `??#>>?`;
            const pathValue = parts.length === 1 ? parts[0] : `{${parts.join(',')}}`;
            return this.query.orWhereRaw(`(${accessor} IS NOT NULL AND ${accessor} != '')`, [
                this.field,
                pathValue,
                this.field,
                pathValue,
            ]);
        }

        return this.query.orWhere(this.field, this.comparisonOp, this.value);
    }
}
