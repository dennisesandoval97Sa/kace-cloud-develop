export class AnsResponse {
    /** @type {Ans} is initialized in the constructor */
    #ans;

    constructor(ans) {
        this.#ans = ans;
    }

    /**
     * Converts the Ans object to a JSON representation.
     *
     * @returns {Object} A plain object containing the Ans data.
     */
    toJson() {
        return {
            data: {
                id: this.#ans.id.value,
                nombre: this.#ans.nombre.value,
                intermedio: this.#ans.intermedio.value,
                vencido: this.#ans.vencido.value,
                color_ans_inicial: this.#ans.color_ans_inicial.value,
                color_ans_intermedio: this.#ans.color_ans_intermedio.value,
                color_ans_final: this.#ans.color_ans_final.value,
                status: this.#ans.status.value,
                medicion_ans_id: this.#ans.medicion_ans_id.value,
                created_at: this.#ans.created_at.value,
                updated_at: this.#ans.updated_at.value,
                created_by: this.#ans.created_by.value,
                updated_by: this.#ans.updated_by.value,
            },
        };
    }
}
