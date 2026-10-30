import { ValueObjectEnum } from '../domain/value-object/ValueObjectEnum';
import { InvalidArgumentError } from '../errors/InvalidArgumentError';

const VALID_DIRECTIONS = {
    ASC: 'asc',
    DESC: 'desc',
};

export class OrderByDirection extends ValueObjectEnum {
    #ascending = VALID_DIRECTIONS.ASC;
    #descending = VALID_DIRECTIONS.DESC;
    constructor(direction) {
        super('direction', direction.toLowerCase(), Object.values(VALID_DIRECTIONS));
    }

    get ascending() {
        return this.#ascending;
    }

    get descending() {
        return this.#descending;
    }

    static fromValue(value) {
        for (const directionValue of Object.keys(VALID_DIRECTIONS)) {
            if (value.toLowerCase() === directionValue.toString()) {
                return new OrderByDirection(VALID_DIRECTIONS[directionValue]);
            }
        }

        throw new InvalidArgumentError(`The direction ${value} is not valid`);
    }
}
