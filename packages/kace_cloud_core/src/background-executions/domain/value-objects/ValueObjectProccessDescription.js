import { BackgroundProcessEnum } from '../../../shared/domain/enum/BackgroundProcessEnum.js';
import { ValueObjectEnum } from '../../../shared/index.js';

export class ValueObjectProccessDescription extends ValueObjectEnum {
    constructor(value) {
        super('proccess_description', value, BackgroundProcessEnum.toJson());
    }
}
