import { CASE_AUXILIARY_DATA_INVALID } from '@kace/error-codes';
import { ValidationFailError } from '../../shared/index.js';

/**
 * Rechazo de los datos del formulario auxiliar. `toPublicData()` publica qué campos
 * fallaron y por qué (sin sus valores): en producción `Response` sustituye el mensaje
 * y solo sobreviven el código y estos datos.
 */
export class AuxiliaryDataInvalidError extends ValidationFailError {
    static exposesPublicData = true;

    /** @type {Array<{ path: string, reason: 'required'|'invalid'|'past_date'|'duplicate' }>} */
    #fields;

    /**
     * @param {string} message
     * @param {Array<{ path: string, reason: 'required'|'invalid'|'past_date'|'duplicate' }>} fields
     * @param {{ details?: Array|null, duplicateFields?: Array }} [options]
     */
    constructor(message, fields, { details = null, duplicateFields = [] } = {}) {
        super(
            message,
            fields.map((item) => item.path).join(', '),
            duplicateFields,
            CASE_AUXILIARY_DATA_INVALID,
            details
        );
        this.#fields = fields;
    }

    /**
     * @param {string} message
     * @param {import('joi').ValidationErrorItem[]} details
     */
    static fromJoi(message, details) {
        const fields = details.map((detail) => ({
            path: detail.path.join('.'),
            reason: detail.type === 'any.required' ? 'required' : 'invalid',
        }));
        return new AuxiliaryDataInvalidError(message, fields, { details });
    }

    toPublicData() {
        return {
            fields: this.#fields.map(({ path, reason }) => ({ field: `aux_cases.${path}`, reason })),
        };
    }
}
