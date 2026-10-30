import { ValueObjectString } from '../../../shared';

export class RuleField extends ValueObjectString {
    constructor(value) {
        super('rule_field', value);
    }
}
