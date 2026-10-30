import { ValueObjectTimestamp } from '../../../shared/index.js';

export class ValueObjectStartExecution extends ValueObjectTimestamp {
    constructor(value) {
        super('start_execution', value, true);
    }
}
