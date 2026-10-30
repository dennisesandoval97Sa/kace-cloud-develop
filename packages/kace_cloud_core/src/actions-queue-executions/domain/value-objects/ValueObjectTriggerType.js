import { ValueObjectEnum } from '../../../shared/domain/value-object/ValueObjectEnum';
import { ActionTriggers } from '../../../shared/domain/enum/ActionTriggersEnum';

export class ValueObjectTriggerType extends ValueObjectEnum {
    constructor(value) {
        super('trigger_type', value, ActionTriggers.toJson(), false);
    }
}
