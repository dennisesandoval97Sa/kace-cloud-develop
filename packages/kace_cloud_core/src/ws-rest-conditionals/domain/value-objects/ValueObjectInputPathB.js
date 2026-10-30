import { ValueObjectString } from '../../../shared/index.js';

export class ValueObjectInputPathB extends ValueObjectString {
    /**
     * @param {String} value
     */
    constructor(value) {
        super('input_path_b', value, true);
    }
}
