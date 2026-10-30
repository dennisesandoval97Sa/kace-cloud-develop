import { ValueObjectString } from './ValueObjectString.js';

export class ValueObjectName extends ValueObjectString {
    constructor(value) {
        super('name', value);
    }
}
