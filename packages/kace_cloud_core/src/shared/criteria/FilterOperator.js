import { ValueObjectEnum } from '../domain/value-object/ValueObjectEnum.js';
import { InvalidArgumentError } from '../errors/InvalidArgumentError';

export const COMPARISION_OPERATORS = {
    // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
    //TODO: faltan los operadores para busquedas de JSONB
    eq: '=',
    neq: '!=',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    between: 'between',
    in: 'in',
    notIn: 'not in',
    like: 'like',
    ilike: 'ilike',
    null: 'null',
    notNull: 'notNull',
    jsonContains: 'json contains',
    jsonArrayValue: 'json array value',
    jsonPathEmpty: 'json path empty',
    jsonNotPathEmpty: 'json not path empty',
    jsonPathDateBetween: 'json path date between',
};

export class FilterOperator extends ValueObjectEnum {
    constructor(operator) {
        super('operator', operator, Object.values(COMPARISION_OPERATORS));
    }

    static fromValue(value) {
        for (const operatorValue of Object.keys(COMPARISION_OPERATORS)) {
            if (value === operatorValue.toString()) {
                return new FilterOperator(COMPARISION_OPERATORS[operatorValue]);
            }
        }

        throw new InvalidArgumentError(`The filter operator ${value} is not valid`);
    }
}
