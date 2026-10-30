export class CaseViewResponse {
    /** @type {ViewCases} is initialized in the constructor */
    #caseView;

    /**
     * Creates an instance of CaseViewResponse.
     *
     * @param {ViewCases} viewCases - The ViewCases instance.
     */
    constructor(viewCases) {
        this.#caseView = viewCases;
    }

    /**
     * Converts the ViewCases object to a JSON representation.
     *
     * @returns {Object} A flat object containing the ViewCases data.
     */
    toJson() {
        if (!this.#caseView) return {};

        return {
            data: {
                id: this.#caseView.id.value,
                created_at: this.#caseView.created_at,
                nivel1: this.#caseView.nivel1,
                nivel2: this.#caseView.nivel2,
                nivel3: this.#caseView.nivel3,
                nivel4: this.#caseView.nivel4,
                nivel5: this.#caseView.nivel5,
                nivel6: this.#caseView.nivel6,
                nivel7: this.#caseView.nivel7,
                nivel8: this.#caseView.nivel8,
                nivel9: this.#caseView.nivel9,
                nivel10: this.#caseView.nivel10,
                color_ans_inicial: this.#caseView.color_ans_inicial,
                color_ans_intermedio: this.#caseView.color_ans_intermedio,
                color_ans_final: this.#caseView.color_ans_final,
                estadoActual: this.#caseView.estadoActual,
                antiguedad: this.#caseView.antiguedad,
                updated_at: this.#caseView.updated_at,
                ans_posicion: this.#caseView.ans_posicion,
                nombres: this.#caseView.nombres,
                apellido1: this.#caseView.apellido1 || '',
                apellido2: this.#caseView.apellido2 || '',
                login: this.#caseView.login,
                usuario_inactivo: this.#caseView.usuario_inactivo,
                nombreCliente: this.#caseView.nombreCliente,
                primerApellido: this.#caseView.primerApellido || '',
                segundoApellido: this.#caseView.segundoApellido || '',
                creator_external_id: this.#caseView.creator_external_id || '',
                documento: this.#caseView.documento,
                tipo_cliente: this.#caseView.tipo_cliente,
                nombre_empresa: this.#caseView.nombre_empresa,
                cambio_estado_comentario_id: this.#caseView.cambio_estado_comentario_id,
                caso_clonado_id: this.#caseView.caso_clonado_id,
                fecha_resolucion: this.#caseView.fecha_resolucion,
                antiguedad_dias: this.#caseView.antiguedad_dias,
                antiguedad_horas: this.#caseView.antiguedad_horas,
                antiguedad_minutos: this.#caseView.antiguedad_minutos,
                motivo_baja: this.#caseView.motivo_baja,
                reference: this.#caseView.reference,
                folio: this.#caseView.folio,
                parent_id: this.#caseView.parent_id,
                ...this.#caseView.aux_data,
            },
        };
    }
}
