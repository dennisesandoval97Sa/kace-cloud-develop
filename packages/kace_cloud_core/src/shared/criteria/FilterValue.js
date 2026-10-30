import { ValueObject } from '../domain/value-object/ValueObject';

export class FilterValue extends ValueObject {
    constructor(value) {
        super('Valor filtro', value);
    }
}
