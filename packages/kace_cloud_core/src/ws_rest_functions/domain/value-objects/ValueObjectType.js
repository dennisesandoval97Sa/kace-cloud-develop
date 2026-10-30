import { WSRestFunctionTypeEnum } from '../../../shared/domain/enum/WSRestFunctionTypeEnum.js';
import { ValueObjectEnum } from '../../../shared/domain/value-object/ValueObjectEnum.js';

export class ValueObjectType extends ValueObjectEnum {
    /**
     * @param {object} value
     * @param {nullable} nullable
     */
    constructor(value, nullable = true) {
        super('type', value, WSRestFunctionTypeEnum.toJson(), nullable);
    }
}
