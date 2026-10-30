import { InvalidArgumentError } from '../errors/InvalidArgumentError';
import { FilterField } from './FilterField';
import { FilterOperator } from './FilterOperator';
import { FilterType } from './FilterType';
import { FilterValue } from './FilterValue';

export class Filter {
    constructor(field, operator, value, type) {
        this.field = field;
        this.operator = operator;
        this.value = value;
        this.type = type;
    }

    static fromValues(values, tablename = null) {
        const field = values.field;
        const operator = values.operator;
        const value = values.value;
        const type = values.type;
        if (!field || !operator || value === null || value === undefined || !type) {
            throw new InvalidArgumentError('Filter must have a field, operator, value, and type');
        }

        return new Filter(
            new FilterField(field, tablename),
            FilterOperator.fromValue(operator),
            new FilterValue(value),
            FilterType.fromValue(type.toUpperCase())
        );
    }

    setValue(value) {
        this.value = new FilterValue(value);
    }

    toJson() {
        const data = {};
        data[this.field.value] = {
            operator: this.operator.value,
            value: this.value.value,
            type: this.type.value,
        };
        return data;
    }
}
