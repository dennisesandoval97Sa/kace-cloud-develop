import { ValueObjectInt } from '../../../shared/domain/value-object/ValueObjectInt.js';
import { Guards } from '../../../shared/domain/guards/Guards.js';

export class ValueObjectCalificacion extends ValueObjectInt {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        this.#ensureIsValidValue(nullable);
    }

    /**
     * `ValueObjectInt` ya acepta el valor nulo cuando `nullable`, pero esta comprobación corría
     * después del `super()` sin mirarlo, así que volvía a exigir un entero y dejaba el flag muerto:
     * ningún comentario podía quedarse sin valoración, ni al crearlo ni al hidratarlo de base de
     * datos. `comentarios.calificacion` es nullable y la lista de comentarios ya pinta un neutro
     * cuando no hay valoración, que es lo que corresponde a un comentario sin encuesta detrás.
     */
    #ensureIsValidValue(nullable) {
        if (nullable && (this.value === null || this.value === undefined)) {
            return;
        }
        Guards.integerType(this);
        Guards.IntegerInRange(this, 1, 10);
    }
}
