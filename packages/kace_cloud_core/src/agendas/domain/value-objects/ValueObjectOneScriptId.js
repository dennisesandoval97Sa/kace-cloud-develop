import { ValueObjectUuid } from '../../../shared/index.js';

export class ValueObjectOneScriptId extends ValueObjectUuid {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);
    }
}
