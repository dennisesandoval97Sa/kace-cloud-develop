export class CaseTransitionsResponse {
    /**
     * @type {CaseTransition[]}
     * is initialized in the constructor
     */
    #caseTransitions;

    constructor(caseTransitions) {
        this.#caseTransitions = caseTransitions;
    }

    toJson() {
        if (this.#caseTransitions === null) return {};
        return {
            data: this.#caseTransitions.map((caseTransition) => {
                return {
                    actualizador: caseTransition.actualizador,
                    fecha: caseTransition.fecha,
                    fecha_transicion: caseTransition.fecha_transicion,
                    responsable: caseTransition.responsable,
                    grupo: caseTransition.grupo,
                    estado_actual: caseTransition.estado_actual,
                    estado_siguiente: caseTransition.estado_siguiente,
                    fecha_resolucion: caseTransition.fecha_resolucion,
                    update_source: caseTransition.update_source,
                    transicion_id: caseTransition.transicion_id,
                    es_reclasificacion: caseTransition.es_reclasificacion,
                    motivo_reclasificacion: caseTransition.motivo_reclasificacion,
                };
            }),
        };
    }
}
