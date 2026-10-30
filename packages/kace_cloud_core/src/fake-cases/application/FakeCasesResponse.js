export class FakeCasesResponse {
    /**
     * @type {FakeCases}
     * is initialized in the constructor
     */
    #kase;

    /**
     *
     * @param {FakeCases} kase instance to return as a json
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
                cliente_id: this.#kase.cliente_id.value,
                transicion_id: this.#kase.transicion_id.value,
                responsable_id: this.#kase.responsable_id.value,
                clasificacion_id: this.#kase.clasificacion_id.value,
                descripcion_caso_id: this.#kase.descripcion_caso_id.value,
                caso_clonado_id: this.#kase.caso_clonado_id.value,
                cambio_estado_comentario_id: this.#kase.cambio_estado_comentario_id.value,
                canal_id: this.#kase.canal_id.value,
                grupo_id: this.#kase.grupo_id.value,
                fecha_resolucion: this.#kase.fecha_resolucion.value,
                antiguedad: this.#kase.antiguedad.value,
                ans_posicion: this.#kase.ans_posicion.value,
                antiguedad_dias: this.#kase.antiguedad_dias.value,
                antiguedad_horas: this.#kase.antiguedad_horas.value,
                antiguedad_minutos: this.#kase.antiguedad_minutos.value,
                motivo_baja: this.#kase.motivo_baja.value,
                alto_impacto: this.#kase.alto_impacto.value,
                vista: this.#kase.vista.value,
                cambio_clasificacion: this.#kase.cambio_clasificacion.value,
                created_at: this.#kase.created_at.value,
                created_by: this.#kase.created_by.value,
                updated_at: this.#kase.updated_at.value,
                updated_by: this.#kase.updated_by.value,
                deleted_at: this.#kase.deleted_at.value,
                deleted_by: this.#kase.deleted_by.value,
            },
        };
    }
}
