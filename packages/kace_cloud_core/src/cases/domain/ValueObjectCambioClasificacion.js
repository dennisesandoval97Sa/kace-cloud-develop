import { ValueObjectBoolean } from '../../shared';

export class ValueObjectCambioClasificacion extends ValueObjectBoolean {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        if (nullable && value === null) return;
    }
}
