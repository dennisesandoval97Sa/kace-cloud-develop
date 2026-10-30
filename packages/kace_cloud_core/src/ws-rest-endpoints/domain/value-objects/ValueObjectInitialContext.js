import { ValueObjectJson } from '../../../shared/domain/value-object/ValueObjectJson.js';

export class ValueObjectInitialContext extends ValueObjectJson {
    constructor(value, nullable = true) {
        const normalized =
            value && typeof value === 'object' && Object.keys(value).length === 0
                ? null
                : value;

        super('initial_context', normalized, nullable);
    }
}
