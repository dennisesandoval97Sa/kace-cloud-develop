import { ValueObjectEnum } from '../domain/value-object/ValueObjectEnum.js';
import { InvalidArgumentError } from '../errors/InvalidArgumentError';

export const RELATIONSHIPS_TYPES = {
    join: 'join',
    left: 'left',
    right: 'right',
};

export class RelationshipType extends ValueObjectEnum {
    constructor(type) {
        super('RelationshipType', type, Object.values(RELATIONSHIPS_TYPES));
    }

    static fromValue(value) {
        for (const relationValue of Object.keys(RELATIONSHIPS_TYPES)) {
            if (value === relationValue.toString()) {
                return new RelationshipType(RELATIONSHIPS_TYPES[relationValue]);
            }
        }

        throw new InvalidArgumentError(`The type relationship ${value} is not valid`);
    }
}
