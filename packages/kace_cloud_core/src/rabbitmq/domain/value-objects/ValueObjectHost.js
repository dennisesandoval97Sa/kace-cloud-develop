import { ValueObjectString } from './ValueObjectString.js';

export class ValueObjectHost extends ValueObjectString {
    constructor(value) {
        super('host', value);
    }
}
