import { ValueObjectBoolean } from '../../../shared/domain/value-object/ValueObjectBoolean';

export class ValueObjectExecutionStatus extends ValueObjectBoolean {
    constructor(value) {
        super('execution_status', value);
    }
}
