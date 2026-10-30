import { ValueObjectString } from '../../../shared/index.js';

export class ValueObjectInputPathA extends ValueObjectString {
    /**
     * @param {String} value
     */
    constructor(value) {
        super('input_path_a', value, true);
    }
}
