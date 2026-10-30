export class SubCaseRelationCollectionResponse {
    /**
     * @type {CaseDataGrid[]}
     * is initialized in the constructor
     */
    #caseDataGrid;

    /**
     * @type {number}
     * is initialized in the constructor
     */
    #count;

    /**
     *
     * @param {CaseDataGrid[]} caseDataGrid array with all object cases
     * @param {number} count number of cases
     */
    constructor(caseDataGrid, count) {
        this.#caseDataGrid = caseDataGrid;
        this.#count = count;
    }

    toJson() {
        if (this.#caseDataGrid === null) return {};
        return {
            data: {
                items: this.#caseDataGrid.map((kase) => {
                    return {
                        id: kase.id.value,
                        created_at: kase.created_at,
                        nivel1: kase.nivel1,
                        nivel2: kase.nivel2,
                        nivel3: kase.nivel3,
                        nivel4: kase.nivel4,
                        nivel5: kase.nivel5,
                        nivel6: kase.nivel6,
                        nivel7: kase.nivel7,
                        nivel8: kase.nivel8,
                        nivel9: kase.nivel9,
                        nivel10: kase.nivel10,
                        color_ans_inicial: kase.color_ans_inicial,
                        color_ans_intermedio: kase.color_ans_intermedio,
                        color_ans_final: kase.color_ans_final,
                        estadoActual: kase.estadoActual,
                        transicion_id: kase.transicion_id,
                        antiguedad: kase.antiguedad,
                        updated_at: kase.updated_at,
                        ans_posicion: kase.ans_posicion,
                        nombres: kase.nombres,
                        apellido1: kase.apellido1 || '',
                        apellido2: kase.apellido2 || '',
                        login: kase.login,
                        usuario_inactivo: kase.usuario_inactivo,
                        nombreCliente: kase.nombreCliente,
                        primerApellido: kase.primerApellido || '',
                        segundoApellido: kase.segundoApellido || '',
                        creator_external_id: kase.creator_external_id || '',
                        documento: kase.documento,
                        tipo_cliente: kase.tipo_cliente,
                        nombre_empresa: kase.nombre_empresa,
                        cambio_estado_comentario_id: kase.cambio_estado_comentario_id,
                        caso_clonado_id: kase.caso_clonado_id,
                        fecha_resolucion: kase.fecha_resolucion,
                        antiguedad_dias: kase.antiguedad_dias,
                        antiguedad_horas: kase.antiguedad_horas,
                        antiguedad_minutos: kase.antiguedad_minutos,
                        motivo_baja: kase.motivo_baja,
                        reference: kase.reference,
                        folio: kase.folio,
                        fecha_vencimiento: kase.sla_due_date,
                        sla_state_position: kase.sla_state_position,
                        parent_id: kase.parent_id,
                        is_visible: kase.is_visible,
                        ...kase.extras,
                    };
                }),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
