export class CaseAnsResponse {
    /**
     * @type {CaseAnsAns}
     * is initialized in the constructor
     */
    #kase;

    /**
     *
     * @param {CaseAnsAns} kase instance to return as a json
     */
    constructor(kase) {
        this.#kase = kase;
    }

    /**
     *
     * @returns {object}
     */
    toJson() {
        if (this.#kase === null) return {};
        return {
            data: {
                id: this.#kase.id.value,
                position: this.#kase.ans_posicion.value,
                elapsedTime: {
                    days: this.#kase.antiguedad_dias.value,
                    hours: this.#kase.antiguedad_horas.value,
                    minutes: this.#kase.antiguedad_minutos.value,
                },
                description: this.#kase.antiguedad.value,
            },
        };
    }
}
