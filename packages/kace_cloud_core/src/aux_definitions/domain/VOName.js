import { Guards, ValueObjectString } from '../../shared/index.js';

export default class VOName extends ValueObjectString {
    constructor(value) {
        super('name', value, false);

        Guards.stringPattern(this, /^[a-z0-9_]+$/);
    }
}
