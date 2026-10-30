import { ValueObjectEnum } from '../domain/value-object/ValueObjectEnum.js';
import { InvalidArgumentError } from '../errors/InvalidArgumentError';

export const FILTER_TYPE = {
    AND: 'AND',
    OR: 'OR',
};
export class FilterType extends ValueObjectEnum {
    constructor(value) {
        super('Type', value, Object.values(FILTER_TYPE));
    }

    static fromValue(value) {
        for (const filterType of Object.values(FILTER_TYPE)) {
            if (value === filterType.toString()) {
                return new FilterType(value);
            }
        }

        throw new InvalidArgumentError(`The filter type ${value} is not valid`);
    }
}
