import { ValueObjectEnum } from '../../shared';

export class ValueObjectProvider extends ValueObjectEnum {
    constructor(field, value, nullable = false) {
        super(field, value.toUpperCase(), ['API', 'UI-ADMIN', 'UI-AGENT'], nullable);
    }
}
