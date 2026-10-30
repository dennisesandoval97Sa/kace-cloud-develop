import { ValueObjectString } from '../../../shared/index.js';

export class ValueObjectExternalCode extends ValueObjectString {
    constructor(value) {
        super('external_code', value);
    }
}
