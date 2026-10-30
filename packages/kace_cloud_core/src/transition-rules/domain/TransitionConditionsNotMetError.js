import { ValidationFailError } from '../../shared/index.js';
import { CASE_TRANSITION_CONDITIONS_NOT_MET } from '@kace/error-codes';

/**
 * El bloqueo por reglas de transición, con las condiciones que lo causaron.
 *
 * El mensaje se mantiene palabra por palabra porque tres consumidores lo tienen acoplado:
 * `caseService.js` y `KaceData.js` del plugin lo traducen por clave EXACTA, y
 * `getTranslatedError.js` de la SPA por substring. El diagnóstico viaja por `toPublicData()`,
 * que es el único canal que sobrevive a producción: allí `Response` sustituye el mensaje por
 * `SAFE_MESSAGES.VALIDATION` y solo publica `data.code` más estos datos.
 */
export class TransitionConditionsNotMetError extends ValidationFailError {
    static exposesPublicData = true;

    static MESSAGE = 'The conditions configured for this transition are not met';

    /** @type {{ combinator: string|null, failed: Array<object> }|null} */
    #diagnostic;

    /**
     * @param {{ combinator: string|null, failed: Array<object> }} [diagnostic] - Veredicto de
     *   `RuleValidator.explain`. Se omite cuando el diagnóstico no se pudo calcular: el bloqueo
     *   sigue siendo el mismo, solo se publica sin detalle.
     */
    constructor(diagnostic = null) {
        super(TransitionConditionsNotMetError.MESSAGE, 'transition_id', [], CASE_TRANSITION_CONDITIONS_NOT_MET);
        this.#diagnostic = diagnostic;
    }

    get diagnostic() {
        return this.#diagnostic;
    }

    toPublicData() {
        if (!this.#diagnostic) return {};

        return {
            conditions: {
                combinator: this.#diagnostic.combinator,
                failed: this.#diagnostic.failed,
            },
        };
    }
}
