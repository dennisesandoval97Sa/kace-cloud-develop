import { ValueObjectEnum } from '../../../shared/domain/value-object/ValueObjectEnum';
import { StatusEnum } from '../enum/StatusEnum';

export class ValueObjectStatus extends ValueObjectEnum {
    constructor(value) {
        super('status', value, StatusEnum.toJson(), false);
    }
}
