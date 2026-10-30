import { ValueObjectUuid } from '../../../shared/index.js';

export class ValueObjectAgendaId extends ValueObjectUuid {
    constructor(field, value) {
        super(field, value);
    }
}
