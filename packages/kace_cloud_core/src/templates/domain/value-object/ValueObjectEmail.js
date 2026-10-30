import { Guards, ValueObjectString } from '../../../shared/index.js';

export class ValueObjectEmail extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (!value && nullable) {
            return;
        } else {
            Guards.stringMaxLength(this, 30000);
            Guards.stringPattern(
                this,
                /^(\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\{\{[a-zA-Z0-9_.]+\}\})\s*)(,\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\{\{[a-zA-Z0-9_.]+\}\})\s*)*$/,
                // SONAR-EXC:Expresión regular necesaria para validar una lista por correos de email o templates de secretos.
                `${this.field}: Invalid value for object email`
            );
        }
    }
}
