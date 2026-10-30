import { ValueObjectInt } from './ValueObjectInt';

export class ValueObjectIntPositives extends ValueObjectInt {
    constructor(path, value, nullable = false) {
        super(path, value, nullable);
        if (nullable) return;
        if (value < 0) {
            throw new Error(`${path}: The value ${value} must be a positive integer`);
        }
    }
}
