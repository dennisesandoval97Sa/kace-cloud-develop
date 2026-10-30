import { ValueObjectInt } from '../../../shared/domain/value-object/ValueObjectInt.js';

export class ValueObjectOrder extends ValueObjectInt {
    /**
     * @param {Int} value
     */
    constructor(value) {
        super('order', value);
    }
}
