import { ValueObjectBoolean } from '../../../shared/index.js';

export class ValueObjectIsActive extends ValueObjectBoolean {
    constructor(field, value) {
        super(field, value);
    }
}
