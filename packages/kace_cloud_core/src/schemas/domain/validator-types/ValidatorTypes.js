import { NumberTypeValidator } from './NumberTypeValidator.js';
import { StringTypeValidator } from './StringTypeValidator.js';
import { BooleanTypeValidator } from './BooleanTypeValidator.js';
import { DateTypeValidator } from './DateTypeValidator.js';
import { ArrayTypeValidator } from './ArrayTypeValidator.js';
import { ObjectTypeValidator } from './ObjectTypeValidator.js';
import { CalculateTypeValidator } from './CalculateTypeValidator.js';

export const validatorTypes = {
    number: new NumberTypeValidator(),
    string: new StringTypeValidator(),
    boolean: new BooleanTypeValidator(),
    date: new DateTypeValidator(),
    array: new ArrayTypeValidator(),
    object: new ObjectTypeValidator(),
    calculated: new CalculateTypeValidator(),
};
