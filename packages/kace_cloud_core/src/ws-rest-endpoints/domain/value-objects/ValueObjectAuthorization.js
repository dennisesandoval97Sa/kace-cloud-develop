import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid';

export class ValueObjectAuthorization extends ValueObjectUuid {
    constructor(value) {
        super('authorization_id', value, true);
    }
}
