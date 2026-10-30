import { ValueObjectJson } from '../../shared/domain/value-object/ValueObjectJson.js';
import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';

export class VOData extends ValueObjectJson {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);
        this.#validateFields(this.value);
    }

    /**
     * Valida cada key del objeto y si el value es string, crea un ValueObjectString.
     * @param {Object} value
     * @private
     */
    #validateFields(value) {
        if (typeof value !== 'object' || value === null) {
            throw new Error(`${this.field}: El valor debe ser un objeto`);
        }
        for (const [key, val] of Object.entries(value)) {
            if (typeof val === 'string') {
                // SONAR-EXC: Instancia para validar, no se almacena
                new ValueObjectString(key, val);
            }
        }
    }
}
