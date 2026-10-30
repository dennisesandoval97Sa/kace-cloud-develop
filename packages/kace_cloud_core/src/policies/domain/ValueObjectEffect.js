import { ValueObjectEnum } from '../../shared';

export class ValueObjectEffect extends ValueObjectEnum {
    constructor(field, value, nullable = false) {
        super(field, value.toUpperCase(), ['ALLOW', 'DENY'], nullable);
    }
}
