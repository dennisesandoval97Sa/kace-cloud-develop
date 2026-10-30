import { StateResponse } from '../../state';
import { TransitionsResponse } from '../../transition';

export class AvailableStatesResponse {
    /**
     * @type {CaseAvailableStates}
     * is initialized in the constructor
     */
    #kase;

    /**
     *
     * @param {CaseAvailableStates} kase instance to return as a json
     */
    constructor(kase) {
        this.#kase = kase;
    }

    /**
     *
     * @returns {object}
     */
    toJson() {
        if (this.#kase.transition == {}) return {};
        return {
            data: {
                transition: new TransitionsResponse(this.#kase.transition).toJson().data,
                estado_actual: new StateResponse(this.#kase.estado_actual).toJson().data,
                estado_siguiente: new StateResponse(this.#kase.estado_siguiente).toJson().data,
            },
        };
    }
}
