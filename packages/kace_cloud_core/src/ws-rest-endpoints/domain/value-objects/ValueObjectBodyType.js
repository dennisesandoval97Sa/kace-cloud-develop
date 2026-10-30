import { ValueObject } from '../../../shared/domain/value-object/ValueObject.js';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';

const VALID_BODY_TYPES = ['json', 'plain_text'];

export class ValueObjectBodyType extends ValueObject {
    constructor(value = 'json') {
        const normalized = value ?? 'json';
        if (!VALID_BODY_TYPES.includes(normalized)) {
            throw new ValidationFailError(`body_type must be one of: ${VALID_BODY_TYPES.join(', ')}`, 'body_type');
        }
        super('body_type', normalized);
    }

    static VALID_TYPES = VALID_BODY_TYPES;
}
