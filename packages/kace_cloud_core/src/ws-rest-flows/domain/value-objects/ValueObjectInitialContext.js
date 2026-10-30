import { ValueObjectJson } from '../../../shared/index.js';

export class ValueObjectInitialContext extends ValueObjectJson {
    constructor(value) {
        super('initial_context', value, true);
    }
}
