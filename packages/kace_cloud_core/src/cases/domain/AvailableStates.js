import { State } from '../../state/index.js';
import { Transitions } from '../../transition/index.js';

export class CaseAvailableStates {
    /**
     * @type {Transitions}
     * is initialized in the constructor
     */
    #transition;

    /**
     * @type {State}
     * is initialized in the constructor
     */
    #estado_actual;

    /**
     * @type {State}
     * is initialized in the constructor
     */
    #estado_siguiente;

    /**
     *
     * @param {Transitions} params.transitions - Transicion.
     * @param {State} params.estado_actual - Estado Actual.
     * @param {State} params.estado_siguiente - Estado Siguiente.
     */
    constructor(transition, estado_actual, estado_siguiente) {
        this.#transition = new Transitions(transition);
        this.#estado_actual = estado_actual ? new State(estado_actual) : null;
        this.#estado_siguiente = new State(estado_siguiente);
    }

    get transition() {
        return this.#transition;
    }

    get estado_actual() {
        return this.#estado_actual;
    }

    get estado_siguiente() {
        return this.#estado_siguiente;
    }
}
