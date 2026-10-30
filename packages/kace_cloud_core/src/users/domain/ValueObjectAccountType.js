import { ValueObjectEnum } from '../../shared';
import { AccountTypeEnum } from '../../shared/domain/enum/AccountTypeEnum';

export class ValueObjectAccountType extends ValueObjectEnum {
    constructor(field, value, nullable) {
        super(field, value, AccountTypeEnum.toJson(), nullable);
    }
}
