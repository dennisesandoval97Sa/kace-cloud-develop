import { ValueObjectTimestamp } from '../../../shared/index.js';

export class ValueObjectEndExecution extends ValueObjectTimestamp {
    constructor(value) {
        super('end_execution', value, true);
    }
}
