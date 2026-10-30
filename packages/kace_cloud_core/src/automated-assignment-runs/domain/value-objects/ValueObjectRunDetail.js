import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class ValueObjectRunDetail {
    /** @type {Object|null} is initialized in the constructor */
    #value = null;

    /**
     * Telemetría interna generada por el sistema: se normaliza (pg → objeto,
     * o string JSON serializado manualmente) sin pasar por ValueObjectJson — sus guards de
     * contenido rechazarían payloads legítimos como stack traces en error_detail.
     */
    constructor(field, value) {
        this.field = field;
        if (value === null || value === undefined) return;
        if (typeof value === 'string') {
            try {
                this.#value = JSON.parse(value);
            } catch (error) {
                Helper.logError(`${field}: invalid JSON column value`, error);
            }
            return;
        }
        this.#value = value;
    }

    get value() {
        return this.#value;
    }
}
